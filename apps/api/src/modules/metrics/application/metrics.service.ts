import { Inject, Injectable } from '@nestjs/common';

import {
  METRICS_REPOSITORY,
  type MetricsRepositoryPort,
  type RawMetricCounts,
} from './metrics.repository.port';

/**
 * Metrics overview (ADR-023). Every derived rate is computed HERE — one
 * definition for every consumer — in [0, 1], and `null` when the
 * denominator is zero: never NaN, never a fake 0%/100%.
 */
export interface MetricsOverview {
  readonly windowDays: number;
  readonly sessions: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
    /** completed / (completed + failed + cancelled). */
    readonly completionRate: number | null;
  };
  readonly actions: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
    readonly byType: Readonly<Record<string, number>>;
    /** ever-approved / (ever-approved + rejected) — decided ones only. */
    readonly approvalRate: number | null;
    /** executed / (executed + failed). */
    readonly executionSuccessRate: number | null;
  };
  readonly approvalsPending: number;
}

function sum(record: Readonly<Record<string, number>>, keys?: readonly string[]): number {
  const entries = keys ?? Object.keys(record);
  return entries.reduce((total, key) => total + (record[key] ?? 0), 0);
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function deriveOverview(raw: RawMetricCounts, windowDays: number): MetricsOverview {
  const closedSessions = sum(raw.sessionsByStatus, ['completed', 'failed', 'cancelled']);
  // Approved actions move on to executed/failed, so decisions are counted
  // from the approval stamp, not the current status.
  const decidedActions = raw.actionsApprovedEver + (raw.actionsByStatus.rejected ?? 0);
  const settledActions = sum(raw.actionsByStatus, ['executed', 'failed']);

  return {
    windowDays,
    sessions: {
      total: sum(raw.sessionsByStatus),
      byStatus: raw.sessionsByStatus,
      completionRate: rate(raw.sessionsByStatus.completed ?? 0, closedSessions),
    },
    actions: {
      total: sum(raw.actionsByStatus),
      byStatus: raw.actionsByStatus,
      byType: raw.actionsByType,
      approvalRate: rate(raw.actionsApprovedEver, decidedActions),
      executionSuccessRate: rate(raw.actionsByStatus.executed ?? 0, settledActions),
    },
    approvalsPending: raw.approvalsPending,
  };
}

@Injectable()
export class MetricsService {
  constructor(
    @Inject(METRICS_REPOSITORY)
    private readonly metrics: MetricsRepositoryPort,
  ) {}

  async overview(tenantId: string, windowDays: number): Promise<MetricsOverview> {
    const raw = await this.metrics.collect(tenantId, windowDays);
    return deriveOverview(raw, windowDays);
  }
}
