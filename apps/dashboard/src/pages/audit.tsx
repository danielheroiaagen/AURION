import { useCallback, type ReactNode } from 'react';

import { listAuditEvents } from '../api/resources';
import { useAuth } from '../auth/auth-context';
import { StatusBadge } from '../components/status-badge';
import { usePaged } from '../components/use-paged';

export function AuditPage(): ReactNode {
  const { client } = useAuth();

  const fetchPage = useCallback(
    (cursor?: string) => listAuditEvents(client, { cursor, limit: 50 }),
    [client],
  );
  const page = usePaged(fetchPage, []);

  return (
    <>
      <h1>Audit evidence</h1>
      {page.error ? <div className="error">{page.error}</div> : null}

      <div className="toolbar">
        <button onClick={page.reload} disabled={page.loading}>
          Refresh
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Outcome</th>
              <th>Actor</th>
              <th>Resource</th>
              <th>Correlation</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((event) => (
              <tr key={event.id}>
                <td>{event.action}</td>
                <td>
                  <StatusBadge status={event.outcome} />
                </td>
                <td>
                  {event.actor_type}
                  {event.actor_user_id ? <div className="muted">{event.actor_user_id}</div> : null}
                </td>
                <td className="muted">
                  {event.resource_type}
                  {event.resource_id ? ` · ${event.resource_id.slice(0, 8)}…` : ''}
                </td>
                <td className="muted">{event.correlation_id}</td>
                <td className="muted">{new Date(event.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!page.loading && page.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No audit events.
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
