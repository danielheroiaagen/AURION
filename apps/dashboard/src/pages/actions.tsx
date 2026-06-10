import { useCallback, useState, type ReactNode } from 'react';

import { approveAction, executeAction, listActions, rejectAction } from '../api/resources';
import type { ControlledActionResponse } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { StatusBadge } from '../components/status-badge';
import { usePaged } from '../components/use-paged';
import { canDecide, canExecute, isTerminal } from '../domain/approval-rules';

const STATUS_FILTERS = ['', 'requested', 'approved', 'rejected', 'executed', 'failed'];

/**
 * The human half of the ADR-013 approval workflow: review requested actions,
 * approve/reject (authority rules mirrored — the server still decides),
 * execute approved work through the real dispatcher.
 */
export function ActionsPage(): ReactNode {
  const { client, session } = useAuth();
  const claims = session!.claims;
  const [status, setStatus] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchPage = useCallback(
    (cursor?: string) => listActions(client, { status: status || undefined, cursor, limit: 25 }),
    [client, status],
  );
  const page = usePaged(fetchPage, [status]);

  async function run(
    id: string,
    operation: (clientArg: typeof client, idArg: string) => Promise<ControlledActionResponse>,
  ): Promise<void> {
    setBusyId(id);
    setActionError(null);
    try {
      await operation(client, id);
      page.reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Operation failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1>Controlled actions</h1>
      {actionError ? <div className="error">{actionError}</div> : null}
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
              <th>Type</th>
              <th>Status</th>
              <th>Requested by</th>
              <th>Approval</th>
              <th>Payload</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((action) => (
              <tr key={action.id}>
                <td>{action.action_type}</td>
                <td>
                  <StatusBadge status={action.status} />
                </td>
                <td>
                  {action.actor_type}
                  {action.actor_user_id ? <div className="muted">{action.actor_user_id}</div> : null}
                </td>
                <td>
                  {action.approval_required ? (
                    action.approved_by_user_id ? (
                      <span className="muted">by {action.approved_by_user_id}</span>
                    ) : (
                      <span className="badge warn">required</span>
                    )
                  ) : (
                    <span className="muted">not required</span>
                  )}
                </td>
                <td>
                  <pre className="payload">{JSON.stringify(action.request_payload, null, 1)}</pre>
                  {action.result_payload ? (
                    <pre className="payload">{JSON.stringify(action.result_payload, null, 1)}</pre>
                  ) : null}
                </td>
                <td className="muted">{new Date(action.created_at).toLocaleString()}</td>
                <td>
                  {isTerminal(action.status) ? null : (
                    <div className="actions-cell">
                      {canDecide(action, claims) ? (
                        <>
                          <button
                            className="primary"
                            disabled={busyId === action.id}
                            onClick={() => void run(action.id, approveAction)}
                          >
                            Approve
                          </button>
                          <button
                            className="danger"
                            disabled={busyId === action.id}
                            onClick={() => void run(action.id, rejectAction)}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {canExecute(action) ? (
                        <button
                          disabled={busyId === action.id}
                          onClick={() => void run(action.id, executeAction)}
                        >
                          Execute
                        </button>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!page.loading && page.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No actions.
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
