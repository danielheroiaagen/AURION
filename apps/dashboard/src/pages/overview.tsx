import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { getMetricsOverview } from '../api/resources';
import type { MetricsOverviewResponse } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { formatRate, toBars } from '../domain/metrics-format';

const REFRESH_MS = 30_000;
const WINDOWS = [7, 30, 90];

function Bars({ data }: { data: Readonly<Record<string, number>> }): ReactNode {
  const bars = toBars(data);
  if (bars.length === 0) {
    return <p className="muted">No data in this window.</p>;
  }
  return (
    <div>
      {bars.map((bar) => (
        <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.3rem 0' }}>
          <span className="muted" style={{ width: '110px' }}>{bar.label}</span>
          <div style={{ flex: 1, background: 'var(--bg)', borderRadius: '4px' }}>
            <div
              style={{
                width: `${Math.max(bar.percent, 2)}%`,
                background: 'var(--accent)',
                height: '10px',
                borderRadius: '4px',
              }}
            />
          </div>
          <span style={{ width: '40px', textAlign: 'right' }}>{bar.count}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }): ReactNode {
  return (
    <div className="card" style={{ flex: 1, textAlign: 'center', marginBottom: 0 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}

export function OverviewPage(): ReactNode {
  const { client } = useAuth();
  const [days, setDays] = useState(7);
  const [metrics, setMetrics] = useState<MetricsOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMetrics(await getMetricsOverview(client, days));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load metrics.');
    }
  }, [client, days]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <>
      <h1>Overview</h1>
      {error ? <div className="error">{error}</div> : null}

      <div className="toolbar">
        <div>
          <label htmlFor="window">Window</label>
          <select id="window" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            {WINDOWS.map((value) => (
              <option key={value} value={value}>
                last {value} days
              </option>
            ))}
          </select>
        </div>
        <span className="muted">auto-refreshes every 30s</span>
      </div>

      {metrics ? (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <Kpi label="conversations" value={metrics.sessions.total} />
            <Kpi label="completion rate" value={formatRate(metrics.sessions.completion_rate)} />
            <Kpi label="actions requested" value={metrics.actions.total} />
            <Kpi label="approval rate" value={formatRate(metrics.actions.approval_rate)} />
            <Kpi
              label="execution success"
              value={formatRate(metrics.actions.execution_success_rate)}
            />
            <Kpi label="awaiting approval" value={metrics.approvals_pending} />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="card" style={{ flex: 1 }}>
              <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Sessions by status</h2>
              <Bars data={metrics.sessions.by_status} />
            </div>
            <div className="card" style={{ flex: 1 }}>
              <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Actions by status</h2>
              <Bars data={metrics.actions.by_status} />
            </div>
            <div className="card" style={{ flex: 1 }}>
              <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Actions by type</h2>
              <Bars data={metrics.actions.by_type} />
            </div>
          </div>
        </>
      ) : !error ? (
        <p className="muted">Loading…</p>
      ) : null}
    </>
  );
}
