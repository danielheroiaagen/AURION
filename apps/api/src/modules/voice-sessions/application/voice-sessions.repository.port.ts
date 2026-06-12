import type { Page } from '../../../common/pagination/cursor';
import type { VoiceSessionStatus } from '../domain/voice-session';

/**
 * Voice session as the application layer sees it. Sensitive fields are
 * plaintext at this boundary: encryption at rest is the repository adapter's
 * concern (ADR-011/ADR-013) and never leaks above the port.
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
  /** Caller phone number (E.164-ish). Plaintext above the port (Phase-30). */
  readonly callerNumber: string | null;
  /** AI-generated summary prose (Phase-30). */
  readonly aiSummary: string | null;
  /** AI-generated structured insights, already parsed (Phase-30). */
  readonly aiInsights: AiInsights | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Structured output of the post-call LLM summarizer (Phase-30). */
export interface AiInsights {
  readonly intent?: string;
  readonly caller_name?: string | null;
  readonly callback_number?: string | null;
  readonly lead_quality?: 'hot' | 'warm' | 'cold' | null;
  readonly action_items?: string[];
  readonly language?: string;
}

export interface CreateVoiceSessionInput {
  readonly tenantId: string;
  readonly externalSessionId: string | null;
  readonly startedByUserId: string | null;
  /** Optional caller phone number captured from Twilio's From param (Phase-30). */
  readonly callerNumber?: string | null;
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

/** Fields for the post-call AI summary patch (Phase-30, idempotent). */
export interface PatchAiSummaryFields {
  readonly aiSummary: string;
  readonly aiInsights: AiInsights;
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
  /**
   * Write AI-generated summary and insights to a terminal session.
   * Idempotent: calling again overwrites. Returns null when the session
   * does not exist.
   */
  patchAiSummary(tenantId: string, id: string, fields: PatchAiSummaryFields): Promise<VoiceSession | null>;
}

/** DI token for the voice sessions repository port. */
export const VOICE_SESSIONS_REPOSITORY = Symbol('VOICE_SESSIONS_REPOSITORY');
