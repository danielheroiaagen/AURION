import type { ActionType } from '../domain/controlled-action';

/**
 * Driven port for controlled action execution (ADR-014).
 *
 * By the time `dispatch` is called, the policy decision point has already
 * authorized execution with the database-recorded approval (ADR-013). The
 * input therefore carries no approval state: the executor must never
 * re-derive authority from a flag it could misread.
 *
 * `actionId` doubles as the downstream idempotency key — HERMES deduplicates
 * by it, so a concurrent double-dispatch settles as one execution.
 */
export interface DispatchInput {
  readonly actionId: string;
  readonly tenantId: string;
  readonly actionType: ActionType;
  readonly requestPayload: Record<string, unknown>;
  readonly correlationId: string;
}

/**
 * Adapters never throw for runtime failures (timeout, non-2xx, bad JSON):
 * they return `ok: false` so the use case settles the action as `failed`
 * deterministically. Only programming errors propagate.
 */
export type DispatchResult =
  | { readonly ok: true; readonly resultPayload: Record<string, unknown> }
  | { readonly ok: false; readonly errorCode: string; readonly message: string };

export interface ActionDispatcherPort {
  dispatch(input: DispatchInput): Promise<DispatchResult>;
}

/** DI token for the action dispatcher port. */
export const ACTION_DISPATCHER = Symbol('ACTION_DISPATCHER');
