import { useCallback, useState, type ReactNode } from 'react';

import { listVoiceSessions } from '../api/resources';
import { useAuth } from '../auth/auth-context';
import { StatusBadge } from '../components/status-badge';
import { usePaged } from '../components/use-paged';

const STATUS_FILTERS = ['', 'started', 'active', 'completed', 'failed', 'cancelled'];

export function SessionsPage(): ReactNode {
  const { client } = useAuth();
  const [status, setStatus] = useState('');

  const fetchPage = useCallback(
    (cursor?: string) =>
      listVoiceSessions(client, { status: status || undefined, cursor, limit: 25 }),
    [client, status],
  );
  const page = usePaged(fetchPage, [status]);

  return (
    <>
      <h1>Voice sessions</h1>
      {page.error ? <div className="error">{page.error}</div> : null}

      <div className="toolbar">
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value || 'all'}
              </option>
            ))}
          </select>
        </div>
        <button onClick={page.reload} disabled={page.loading}>
          Refresh
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>External id</th>
              <th>Status</th>
              <th>Summary</th>
              <th>Outcome</th>
              <th>Started</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((session) => (
              <tr key={session.id}>
                <td className="muted">{session.external_session_id ?? session.id.slice(0, 8)}</td>
                <td>
                  <StatusBadge status={session.status} />
                </td>
                <td>{session.summary ?? <span className="muted">—</span>}</td>
                <td className="muted">{session.outcome ?? '—'}</td>
                <td className="muted">{new Date(session.started_at).toLocaleString()}</td>
                <td className="muted">
                  {session.ended_at ? new Date(session.ended_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {!page.loading && page.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No sessions.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {page.hasMore ? (
          <div className="load-more">
            <button onClick={page.loadMore} disabled={page.loading}>
              Load more
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
