import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { requireActorTenant } from '../../../common/http/actor-tenant';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { MetricsService, type MetricsOverview } from '../application/metrics.service';

export class MetricsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 90, default: 7, description: 'Window in days.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days = 7;
}

/** Stable response shape (ADR-009): snake_case; rates in [0,1] or null. */
export interface MetricsOverviewResponse {
  window_days: number;
  sessions: {
    total: number;
    by_status: Record<string, number>;
    completion_rate: number | null;
  };
  actions: {
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    approval_rate: number | null;
    execution_success_rate: number | null;
  };
  approvals_pending: number;
}

function toResponse(overview: MetricsOverview): MetricsOverviewResponse {
  return {
    window_days: overview.windowDays,
    sessions: {
      total: overview.sessions.total,
      by_status: { ...overview.sessions.byStatus },
      completion_rate: overview.sessions.completionRate,
    },
    actions: {
      total: overview.actions.total,
      by_status: { ...overview.actions.byStatus },
      by_type: { ...overview.actions.byType },
      approval_rate: overview.actions.approvalRate,
      execution_success_rate: overview.actions.executionSuccessRate,
    },
    approvals_pending: overview.approvalsPending,
  };
}

/** Supervision metrics (ADR-023): tenant-scoped aggregates inside RLS. */
@ApiTags('metrics')
@ApiBearerAuth()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('overview')
  @RequirePermission('metrics:read')
  @ApiOperation({ summary: 'Tenant supervision KPIs over a bounded window.' })
  async overview(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: MetricsQueryDto,
  ): Promise<MetricsOverviewResponse> {
    return toResponse(await this.metrics.overview(requireActorTenant(actor), query.days));
  }
}
