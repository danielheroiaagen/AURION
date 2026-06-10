import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Max, Min } from 'class-validator';

import type { Page } from '../../../common/pagination/cursor';
import {
  VOICE_SESSION_STATUSES,
  type VoiceSessionStatus,
} from '../domain/voice-session';
import type { VoiceSession } from '../application/voice-sessions.repository.port';

export class StartVoiceSessionDto {
  @ApiPropertyOptional({
    description:
      'Stable id from the realtime provider. Retries with the same id return the existing session.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  external_session_id?: string;
}

export class ListVoiceSessionsQueryDto {
  @ApiPropertyOptional({ enum: VOICE_SESSION_STATUSES })
  @IsOptional()
  @IsIn(VOICE_SESSION_STATUSES)
  status?: VoiceSessionStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Opaque cursor from a previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ChangeVoiceSessionStatusDto {
  @ApiProperty({ enum: VOICE_SESSION_STATUSES })
  @IsIn(VOICE_SESSION_STATUSES)
  status!: VoiceSessionStatus;

  @ApiPropertyOptional({
    description: 'Conversation summary; accepted only on closing transitions. Encrypted at rest.',
    maxLength: 20000,
  })
  @IsOptional()
  @IsString()
  @Length(1, 20000)
  summary?: string;

  @ApiPropertyOptional({ description: 'Business outcome; closing transitions only.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  outcome?: string;

  @ApiPropertyOptional({ description: 'Transcript location; closing transitions only.', maxLength: 2048 })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @Length(1, 2048)
  transcript_uri?: string;
}

/** Stable response shape (ADR-009): snake_case, ISO-8601 timestamps. */
export interface VoiceSessionResponse {
  id: string;
  tenant_id: string;
  external_session_id: string | null;
  started_by_user_id: string | null;
  status: string;
  transcript_uri: string | null;
  summary: string | null;
  outcome: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export function toVoiceSessionResponse(session: VoiceSession): VoiceSessionResponse {
  return {
    id: session.id,
    tenant_id: session.tenantId,
    external_session_id: session.externalSessionId,
    started_by_user_id: session.startedByUserId,
    status: session.status,
    transcript_uri: session.transcriptUri,
    summary: session.summary,
    outcome: session.outcome,
    started_at: session.startedAt.toISOString(),
    ended_at: session.endedAt?.toISOString() ?? null,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
  };
}

export interface VoiceSessionListResponse {
  items: VoiceSessionResponse[];
  next_cursor: string | null;
}

export function toVoiceSessionListResponse(page: Page<VoiceSession>): VoiceSessionListResponse {
  return {
    items: page.items.map(toVoiceSessionResponse),
    next_cursor: page.nextCursor,
  };
}
