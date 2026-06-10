import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

import type { Page } from '../../../common/pagination/cursor';
import type { AuditOutcome } from '../../../database/database.schema';
import type { AuditEvent } from '../application/audit-events.repository.port';

const AUDIT_OUTCOMES = ['allowed', 'denied', 'succeeded', 'failed'] as const;

export class ListAuditEventsQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_OUTCOMES })
  @IsOptional()
  @IsIn(AUDIT_OUTCOMES)
  outcome?: AuditOutcome;

  @ApiPropertyOptional({ description: 'Filter by request correlation id.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  correlation_id?: string;

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

/** Stable response shape (ADR-009): snake_case, ISO-8601 timestamps. */
export interface AuditEventResponse {
  id: string;
  tenant_id: string;
  actor_type: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: string;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function toAuditEventResponse(event: AuditEvent): AuditEventResponse {
  return {
    id: event.id,
    tenant_id: event.tenantId,
    actor_type: event.actorType,
    actor_user_id: event.actorUserId,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId,
    outcome: event.outcome,
    correlation_id: event.correlationId,
    metadata: event.metadata,
    created_at: event.createdAt.toISOString(),
  };
}

export interface AuditEventListResponse {
  items: AuditEventResponse[];
  next_cursor: string | null;
}

export function toAuditEventListResponse(page: Page<AuditEvent>): AuditEventListResponse {
  return {
    items: page.items.map(toAuditEventResponse),
    next_cursor: page.nextCursor,
  };
}
