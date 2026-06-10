import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Page } from '../../../common/pagination/cursor';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { canTransition, isClosing, type VoiceSessionStatus } from '../domain/voice-session';
import {
  VOICE_SESSIONS_REPOSITORY,
  type CloseVoiceSessionFields,
  type ListVoiceSessionsInput,
  type VoiceSession,
  type VoiceSessionsRepositoryPort,
} from './voice-sessions.repository.port';

/**
 * Voice session use cases (ADR-013). Owns lifecycle semantics: natural
 * idempotency on `external_session_id`, legal transitions, and the rule that
 * outcome fields only accompany closing transitions.
 */
@Injectable()
export class VoiceSessionsService {
  constructor(
    @Inject(VOICE_SESSIONS_REPOSITORY)
    private readonly sessions: VoiceSessionsRepositoryPort,
  ) {}

  /**
   * Start a session. When `externalSessionId` is provided and already known,
   * the existing session is returned (`created: false`) — safe retries from
   * the voice runtime without duplicate evidence.
   */
  async start(
    actor: AuthenticatedActor,
    tenantId: string,
    externalSessionId: string | null,
  ): Promise<{ session: VoiceSession; created: boolean }> {
    if (externalSessionId) {
      const existing = await this.sessions.findByExternalSessionId(tenantId, externalSessionId);
      if (existing) {
        return { session: existing, created: false };
      }
    }
    const session = await this.sessions.create({
      tenantId,
      externalSessionId,
      // Machine actors carry no user row; attribution stays in audit evidence.
      startedByUserId: actor.type === 'user' ? actor.id : null,
    });
    return { session, created: true };
  }

  async getById(tenantId: string, id: string): Promise<VoiceSession> {
    const session = await this.sessions.findById(tenantId, id);
    if (!session) {
      throw new NotFoundException('Voice session not found.');
    }
    return session;
  }

  async list(input: ListVoiceSessionsInput): Promise<Page<VoiceSession>> {
    return this.sessions.list(input);
  }

  async changeStatus(
    tenantId: string,
    id: string,
    nextStatus: VoiceSessionStatus,
    closeFields: CloseVoiceSessionFields,
  ): Promise<VoiceSession> {
    const hasCloseFields =
      closeFields.summary !== undefined ||
      closeFields.outcome !== undefined ||
      closeFields.transcriptUri !== undefined;
    if (hasCloseFields && !isClosing(nextStatus)) {
      throw new BadRequestException(
        'summary, outcome, and transcript_uri are only accepted when closing a session.',
      );
    }

    const current = await this.getById(tenantId, id);
    if (!canTransition(current.status, nextStatus)) {
      throw new ConflictException(
        `Illegal status transition "${current.status}" -> "${nextStatus}".`,
      );
    }

    const updated = await this.sessions.transitionStatus(
      tenantId,
      id,
      current.status,
      nextStatus,
      isClosing(nextStatus) ? closeFields : undefined,
    );
    if (!updated) {
      throw new ConflictException('Session status changed concurrently; retry.');
    }
    return updated;
  }
}
