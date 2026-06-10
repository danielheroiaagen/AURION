/**
 * Raw counts the metrics overview is derived from (ADR-023). The adapter
 * aggregates inside the tenant scope — RLS guarantees a metrics query can
 * never see another tenant's rows.
 */
export interface RawMetricCounts {
  readonly sessionsByStatus: Readonly<Record<string, number>>;
  readonly actionsByStatus: Readonly<Record<string, number>>;
  readonly actionsByType: Readonly<Record<string, number>>;
  /**
   * Actions that EVER received an approval (`approved_by_user_id` set) —
   * approved actions move on to executed/failed, so current status would
   * undercount decisions.
   */
  readonly actionsApprovedEver: number;
  /** Current `requested` actions — the live workload, window-independent. */
  readonly approvalsPending: number;
}

export interface MetricsRepositoryPort {
  collect(tenantId: string, windowDays: number): Promise<RawMetricCounts>;
}

/** DI token for the metrics repository port. */
export const METRICS_REPOSITORY = Symbol('METRICS_REPOSITORY');
