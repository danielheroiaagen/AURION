/**
 * Voice session lifecycle (ADR-009 "Voice sessions" group, ADR-013).
 *
 * Mirrors the `voice_sessions.status` CHECK constraint and encodes the legal
 * transitions:
 *
 *   started → active → completed | failed
 *   started | active → cancelled
 *
 * Terminal states (`completed`, `failed`, `cancelled`) never transition.
 */
export const VOICE_SESSION_STATUSES = [
  'started',
  'active',
  'completed',
  'failed',
  'cancelled',
] as const;

export type VoiceSessionStatus = (typeof VOICE_SESSION_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<VoiceSessionStatus, readonly VoiceSessionStatus[]> = {
  started: ['active', 'completed', 'failed', 'cancelled'],
  active: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: VoiceSessionStatus, to: VoiceSessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** States in which the session's outcome fields (summary, outcome) may be set. */
export const CLOSING_STATUSES: ReadonlySet<VoiceSessionStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
]);

export function isClosing(status: VoiceSessionStatus): boolean {
  return CLOSING_STATUSES.has(status);
}
