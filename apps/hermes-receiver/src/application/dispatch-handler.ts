import { ConnectorError, type ConnectorRegistry } from './connector.port.js';

/**
 * Dispatch use case (ADR-019): validate the message shape, execute the
 * matching connector AT MOST ONCE per action_id, and answer with the JSON
 * evidence. Replays return the original result — the receiver-side mirror
 * of AURION's Idempotency-Key contract, absorbing the documented
 * double-dispatch race (ADR-014).
 */
export interface DispatchMessage {
  readonly action_id: string;
  readonly tenant_id: string;
  readonly action_type: string;
  readonly request_payload: Record<string, unknown>;
  readonly correlation_id: string;
}

export type HandlerResponse =
  | { readonly status: 200; readonly body: Record<string, unknown> }
  | { readonly status: 400 | 422 | 502; readonly body: { code: string; message: string } };

export function parseDispatchMessage(value: unknown): DispatchMessage | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const message = value as Record<string, unknown>;
  if (
    typeof message.action_id !== 'string' ||
    message.action_id.length === 0 ||
    typeof message.tenant_id !== 'string' ||
    typeof message.action_type !== 'string' ||
    typeof message.correlation_id !== 'string' ||
    message.request_payload === null ||
    typeof message.request_payload !== 'object' ||
    Array.isArray(message.request_payload)
  ) {
    return null;
  }
  return message as unknown as DispatchMessage;
}

/** LRU-capped dedupe store: executed action_id → original evidence. */
export class DedupeStore {
  private readonly results = new Map<string, Record<string, unknown>>();

  constructor(private readonly capacity: number) {}

  get(actionId: string): Record<string, unknown> | null {
    return this.results.get(actionId) ?? null;
  }

  put(actionId: string, result: Record<string, unknown>): void {
    if (this.results.size >= this.capacity) {
      const oldest = this.results.keys().next().value;
      if (oldest !== undefined) {
        this.results.delete(oldest);
      }
    }
    this.results.set(actionId, result);
  }
}

export async function handleDispatch(
  message: DispatchMessage,
  registry: ConnectorRegistry,
  dedupe: DedupeStore,
): Promise<HandlerResponse> {
  const replayed = dedupe.get(message.action_id);
  if (replayed) {
    return { status: 200, body: { ...replayed, replayed: true } };
  }

  const connector = registry.find(message.action_type);
  if (!connector) {
    // Never a silent success: an unknown type is an explicit rejection.
    return {
      status: 422,
      body: {
        code: 'unknown_action_type',
        message: `No connector for action type "${message.action_type}".`,
      },
    };
  }

  try {
    const result = await connector.execute(message.request_payload);
    const evidence = {
      ...result,
      action_id: message.action_id,
      correlation_id: message.correlation_id,
    };
    dedupe.put(message.action_id, evidence);
    return { status: 200, body: evidence };
  } catch (error) {
    const detail =
      error instanceof ConnectorError ? error.message : 'Connector execution failed.';
    return { status: 502, body: { code: 'connector_failed', message: detail } };
  }
}
