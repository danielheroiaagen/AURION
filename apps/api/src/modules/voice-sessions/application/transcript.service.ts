import { Inject, Injectable } from '@nestjs/common';

import {
  TRANSCRIPT_REPOSITORY,
  type ConversationTurnRecord,
  type TranscriptRepositoryPort,
  type TranscriptTurnInput,
} from './transcript.repository.port';
import { VoiceSessionsService } from './voice-sessions.service';

/**
 * Transcript retention use cases (ADR-039). The session is resolved first so
 * an unknown id is a clean 404 (the tenant boundary is RLS regardless), and
 * appends are idempotent on `(session, turn_index)` at the repository.
 */
@Injectable()
export class TranscriptService {
  constructor(
    @Inject(TRANSCRIPT_REPOSITORY)
    private readonly transcripts: TranscriptRepositoryPort,
    private readonly sessions: VoiceSessionsService,
  ) {}

  async append(
    tenantId: string,
    voiceSessionId: string,
    turns: readonly TranscriptTurnInput[],
  ): Promise<{ persisted: number }> {
    await this.sessions.getById(tenantId, voiceSessionId);
    const persisted = await this.transcripts.append({ tenantId, voiceSessionId, turns });
    return { persisted };
  }

  async getTranscript(tenantId: string, voiceSessionId: string): Promise<ConversationTurnRecord[]> {
    await this.sessions.getById(tenantId, voiceSessionId);
    return this.transcripts.list(tenantId, voiceSessionId);
  }
}
