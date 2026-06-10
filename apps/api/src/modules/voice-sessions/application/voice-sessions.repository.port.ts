import type { Page } from '../../../common/pagination/cursor';
import type { VoiceSessionStatus } from '../domain/voice-session';

/**
 * Voice session as the application layer sees it. `summary` is plaintext at
 * this boundary: encryption at rest is the repository adapter's concern
 * (ADR-011/ADR-013) and never leaks above the port.
 */
export interface VoiceSession {
  readonly id: string;
  readonly tenantId: string;
  readonly externalSessionId: string | null;
  readonly startedByUserId: string | null;
  readonly status: VoiceSessionStatus;
  readonly transcriptUri: string | null;
  readonly summary: string | null;
  readonly outcome: string | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateVoiceSessionInput {
  readonly tenantId: string;
  readonly externalSessionId: string | null;
  readonly startedByUserId: string | null;
}

export interface ListVoiceSessionsInput {
  readonly tenantId: string;
  readonly status?: VoiceSessionStatus;
  readonly limit: number;
  readonly cursor?: string;
}

/** Fields that may accompany a transition into a closing state (ADR-013). */
export interface CloseVoiceSessionFields {
  readonly summary?: string;
  readonly outcome?: string;
  readonly transcriptUri?: string;
}

export interface VoiceSessionsRepositoryPort {
  create(input: CreateVoiceSessionInput): Promise<VoiceSession>;
  findById(tenantId: string, id: string): Promise<VoiceSession | null>;
  findByExternalSessionId(
    tenantId: string,
    externalSessionId: string,
  ): Promise<VoiceSession | null>;
  list(input: ListVoiceSessionsInput): Promise<Page<VoiceSession>>;
  /**
   * Compare-and-set status transition. Returns the updated session, or null
   * when the session does not exist or its status changed concurrently.
   * Closing transitions stamp `ended_at` and may set outcome fields.
   */
  transitionStatus(
    tenantId: string,
    id: string,
    expectedStatus: VoiceSessionStatus,
    nextStatus: VoiceSessionStatus,
    closeFields?: CloseVoiceSessionFields,
  ): Promise<VoiceSession | null>;
}

/** DI token for the voice sessions repository port. */
export const VOICE_SESSIONS_REPOSITORY = Symbol('VOICE_SESSIONS_REPOSITORY');
