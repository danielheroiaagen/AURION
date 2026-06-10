import { deriveOverview } from '../../src/modules/metrics/application/metrics.service';
import type { RawMetricCounts } from '../../src/modules/metrics/application/metrics.repository.port';

function raw(overrides: Partial<RawMetricCounts> = {}): RawMetricCounts {
  return {
    sessionsByStatus: {},
    actionsByStatus: {},
    actionsByType: {},
    actionsApprovedEver: 0,
    approvalsPending: 0,
    ...overrides,
  };
}

describe('deriveOverview (ADR-023 rate definitions)', () => {
  it('computes totals and rates from the raw counts', () => {
    const overview = deriveOverview(
      raw({
        sessionsByStatus: { completed: 6, failed: 2, cancelled: 2, active: 5 },
        actionsByStatus: { executed: 3, failed: 1, rejected: 2, requested: 4 },
        actionsByType: { 'ticket.create': 8, 'calendar.update': 2 },
        actionsApprovedEver: 4,
        approvalsPending: 4,
      }),
      7,
    );

    expect(overview.sessions.total).toBe(15);
    // completed / (completed + failed + cancelled) = 6/10
    expect(overview.sessions.completionRate).toBeCloseTo(0.6);
    expect(overview.actions.total).toBe(10);
    // ever-approved / (ever-approved + rejected) = 4/6 — current statuses
    // would undercount because approved actions moved on to executed.
    expect(overview.actions.approvalRate).toBeCloseTo(4 / 6);
    // executed / (executed + failed) = 3/4
    expect(overview.actions.executionSuccessRate).toBeCloseTo(0.75);
    expect(overview.approvalsPending).toBe(4);
    expect(overview.windowDays).toBe(7);
  });

  it('returns null rates on zero denominators — never NaN or fake percentages', () => {
    const overview = deriveOverview(raw({ sessionsByStatus: { active: 3 } }), 30);
    expect(overview.sessions.completionRate).toBeNull();
    expect(overview.actions.approvalRate).toBeNull();
    expect(overview.actions.executionSuccessRate).toBeNull();
    expect(overview.sessions.total).toBe(3);
  });
});
