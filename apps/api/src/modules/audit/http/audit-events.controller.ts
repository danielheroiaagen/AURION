import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { requireActorTenant } from '../../../common/http/actor-tenant';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import {
  AUDIT_EVENTS_REPOSITORY,
  type AuditEventsRepositoryPort,
} from '../application/audit-events.repository.port';
import {
  ListAuditEventsQueryDto,
  toAuditEventListResponse,
  type AuditEventListResponse,
} from './audit-events.dto';

/**
 * Audit evidence reads (ADR-009 `/api/v1/audit-events`). Read-only: writes
 * happen exclusively through the audit sink, and the table is append-only at
 * the database layer.
 */
@ApiTags('audit-events')
@ApiBearerAuth()
@Controller('audit-events')
export class AuditEventsController {
  constructor(
    @Inject(AUDIT_EVENTS_REPOSITORY) private readonly events: AuditEventsRepositoryPort,
  ) {}

  @Get()
  @RequirePermission('audit:read')
  @ApiOperation({ summary: 'List audit evidence (cursor pagination).' })
  async list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListAuditEventsQueryDto,
  ): Promise<AuditEventListResponse> {
    const page = await this.events.list({
      tenantId: requireActorTenant(actor),
      outcome: query.outcome,
      correlationId: query.correlation_id,
      limit: query.limit,
      cursor: query.cursor,
    });
    return toAuditEventListResponse(page);
  }
}
