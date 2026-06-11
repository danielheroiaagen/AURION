import type { Permission } from '../../auth/domain/permissions';

/**
 * Controlled action domain rules (ADR-009 "Controlled actions" group, ADR-013).
 *
 * An action type maps 1:1 to a `tool:execute:*` permission from the catalog —
 * the policy decision point authorizes the permission, never the raw string.
 *
 * Lifecycle (mirrors the `controlled_actions.status` CHECK constraint):
 *
 *   requested → approved | rejected
 *   approved  → executed | failed
 *   requested → executed | failed   (only when approval is not required;
 *                                    enforced by the use case, which knows
 *                                    `approval_required`)
 *
 * `cancelled` is reserved (no MVP endpoint; withdrawal goes through reject).
 */
export const ACTION_TYPES = [
  'calendar.update',
  'ticket.create',
  'email.send',
  'whatsapp.send',
  'lead.capture',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export function toolPermission(actionType: ActionType): Permission {
  return `tool:execute:${actionType}` as Permission;
}

export const CONTROLLED_ACTION_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'executed',
  'failed',
  'cancelled',
] as const;

export type ControlledActionStatus = (typeof CONTROLLED_ACTION_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<ControlledActionStatus, readonly ControlledActionStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['executed', 'failed'],
  rejected: [],
  executed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(
  from: ControlledActionStatus,
  to: ControlledActionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Canonical JSON: stable key order at every depth, so payload equality for
 * idempotent replays does not depend on client serialization order.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    );
  }
  return value;
}
