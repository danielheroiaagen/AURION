/**
 * Receiver configuration (ADR-019/ADR-030), read once at startup. Fail
 * closed: there is no unsigned mode — the shared dispatch secret is
 * mandatory, and n8n connector mode refuses to boot without its webhook
 * base URL.
 */
export type ConnectorMode = 'stub' | 'n8n';

export interface N8nConfig {
  /** Base webhook URL, e.g. http://n8n:5678/webhook (private network). */
  readonly webhookBase: string;
  readonly timeoutMs: number;
  /** Optional shared header so workflows can verify the caller. */
  readonly secret: string | null;
}

export interface ReceiverConfig {
  readonly port: number;
  /** Must equal the API's HERMES_DISPATCH_SECRET (pairwise symmetric key). */
  readonly secret: string;
  /** Accepted clock drift for the signed timestamp, seconds (default 300). */
  readonly stalenessWindowSec: number;
  /** LRU capacity of the in-memory action_id dedupe store. */
  readonly dedupeCapacity: number;
  readonly connectorMode: ConnectorMode;
  readonly n8n: N8nConfig | null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadReceiverConfig(env: NodeJS.ProcessEnv = process.env): ReceiverConfig {
  const secret = env.HERMES_RECEIVER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'HERMES_RECEIVER_SECRET is required and must be at least 32 characters (ADR-019). There is no unsigned mode.',
    );
  }
  const connectorMode = (env.CONNECTOR_MODE ?? 'stub').trim();
  if (connectorMode !== 'stub' && connectorMode !== 'n8n') {
    throw new Error(`CONNECTOR_MODE "${connectorMode}" is unknown; supported: stub, n8n.`);
  }

  let n8n: N8nConfig | null = null;
  if (connectorMode === 'n8n') {
    const webhookBase = (env.N8N_WEBHOOK_BASE ?? '').trim();
    if (!/^https?:\/\//.test(webhookBase)) {
      throw new Error('N8N_WEBHOOK_BASE is required in n8n connector mode (ADR-030).');
    }
    n8n = {
      webhookBase: webhookBase.replace(/\/+$/, ''),
      timeoutMs: parsePositiveInt(env.N8N_TIMEOUT_MS, 30_000),
      secret: (env.N8N_SECRET ?? '').trim() || null,
    };
  }

  return {
    port: parsePositiveInt(env.PORT, 8090),
    secret,
    stalenessWindowSec: parsePositiveInt(env.HERMES_STALENESS_WINDOW_SEC, 300),
    dedupeCapacity: parsePositiveInt(env.HERMES_DEDUPE_CAPACITY, 10_000),
    connectorMode,
    n8n,
  };
}
