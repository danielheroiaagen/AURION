import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import type { Page } from '../../../common/pagination/cursor';
import {
  ACTION_TYPES,
  CONTROLLED_ACTION_STATUSES,
  type ActionType,
  type ControlledActionStatus,
} from '../domain/controlled-action';
import type { ControlledAction } from '../application/controlled-actions.repository.port';

export class RequestActionDto {
  @ApiProperty({ enum: ACTION_TYPES })
  @IsIn(ACTION_TYPES)
  action_type!: ActionType;

  @ApiPropertyOptional({ description: 'Voice session this action originates from.' })
  @IsOptional()
  @IsUUID()
  voice_session_id?: string;

  @ApiProperty({
    description: 'Tool request payload. Encrypted at rest.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  request_payload!: Record<string, unknown>;
}

export class ListActionsQueryDto {
  @ApiPropertyOptional({ enum: CONTROLLED_ACTION_STATUSES })
  @IsOptional()
  @IsIn(CONTROLLED_ACTION_STATUSES)
  status?: ControlledActionStatus;

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

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

/**
 * Validate the required `Idempotency-Key` header (ADR-009/ADR-013). Header
 * values bypass the DTO validation pipe, so the contract is enforced here.
 */
export function requireIdempotencyKey(value: string | undefined): string {
  if (!value || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new BadRequestException(
      'Idempotency-Key header is required (1-200 chars: letters, digits, ".", "_", ":", "-").',
    );
  }
  return value;
}

/** Stable response shape (ADR-009): snake_case, ISO-8601 timestamps. */
export interface ControlledActionResponse {
  id: string;
  tenant_id: string;
  voice_session_id: string | null;
  action_type: string;
  status: string;
  actor_type: string;
  actor_user_id: string | null;
  idempotency_key: string;
  request_payload: Record<string, unknown>;
  result_payload: Record<string, unknown> | null;
  approval_required: boolean;
  approved_by_user_id: string | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

export function toControlledActionResponse(action: ControlledAction): ControlledActionResponse {
  return {
    id: action.id,
    tenant_id: action.tenantId,
    voice_session_id: action.voiceSessionId,
    action_type: action.actionType,
    status: action.status,
    actor_type: action.actorType,
    actor_user_id: action.actorUserId,
    idempotency_key: action.idempotencyKey,
    request_payload: action.requestPayload,
    result_payload: action.resultPayload,
    approval_required: action.approvalRequired,
    approved_by_user_id: action.approvedByUserId,
    correlation_id: action.correlationId,
    created_at: action.createdAt.toISOString(),
    updated_at: action.updatedAt.toISOString(),
  };
}

export interface ControlledActionListResponse {
  items: ControlledActionResponse[];
  next_cursor: string | null;
}

export function toControlledActionListResponse(
  page: Page<ControlledAction>,
): ControlledActionListResponse {
  return {
    items: page.items.map(toControlledActionResponse),
    next_cursor: page.nextCursor,
  };
}
