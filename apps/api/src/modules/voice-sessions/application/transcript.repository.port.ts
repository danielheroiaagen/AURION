import type { TurnSpeaker } from '../../../database/database.schema';

/**
 * One retained transcript turn as the application sees it (ADR-039). `text`
 * is plaintext at this boundary; encryption at rest is the repository
 * adapter's concern and never leaks above the port.
 */
export interface ConversationTurnRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly voiceSessionId: string;
  readonly turnIndex: number;
  readonly speaker: TurnSpeaker;
  readonly text: string;
  readonly createdAt: Date;
}

export interface TranscriptTurnInput {
  readonly turnIndex: number;
  readonly speaker: TurnSpeaker;
  readonly text: string;
}

export interface AppendTranscriptInput {
  readonly tenantId: string;
  readonly voiceSessionId: string;
  readonly turns: readonly TranscriptTurnInput[];
}

export interface TranscriptRepositoryPort {
  /**
   * Append turns idempotently: a replay of the same `(session, turn_index)`
   * is ignored, never duplicated. Returns the number of NEW turns persisted.
   */
  append(input: AppendTranscriptInput): Promise<number>;
  /** Turns for a session, ordered by index, decrypted. */
  list(tenantId: string, voiceSessionId: string): Promise<ConversationTurnRecord[]>;
}

/** DI token for the transcript repository port. */
export const TRANSCRIPT_REPOSITORY = Symbol('TRANSCRIPT_REPOSITORY');
