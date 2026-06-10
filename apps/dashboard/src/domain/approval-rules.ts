import type { ControlledActionResponse } from '../api/types';
import type { SessionClaims } from '../auth/session';

/**
 * UX mirror of the ADR-013 approval authority rules. The dashboard uses
 * these to avoid offering buttons the policy decision point will deny —
 * the SERVER remains the only authority; getting these wrong can never
 * grant anything, only mis-hide a button.
 */
export const TERMINAL_STATUSES = new Set(['rejected', 'executed', 'failed', 'cancelled']);

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Human actors only, never the requester, only while still requested. */
export function canDecide(action: ControlledActionResponse, claims: SessionClaims): boolean {
  return (
    action.status === 'requested' &&
    claims.actorType === 'user' &&
    action.actor_user_id !== claims.sub
  );
}

/** Gated actions execute from `approved`; non-gated directly from `requested`. */
export function canExecute(action: ControlledActionResponse): boolean {
  const expected = action.approval_required ? 'approved' : 'requested';
  return action.status === expected;
}
