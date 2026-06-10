import { useCallback, useState, type FormEvent, type ReactNode } from 'react';

import { inviteUser, listUsers, updateMembership } from '../api/resources';
import { useAuth } from '../auth/auth-context';
import { StatusBadge } from '../components/status-badge';
import { usePaged } from '../components/use-paged';

const ASSIGNABLE_ROLES = ['tenant_admin', 'supervisor', 'human_agent', 'developer_integrator', 'auditor'];

export function UsersPage(): ReactNode {
  const { client, session } = useAuth();
  const claims = session!.claims;
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState({ email: '', display_name: '', role: 'human_agent' });
  const [busy, setBusy] = useState(false);

  const fetchPage = useCallback(
    (cursor?: string) => listUsers(client, { cursor, limit: 25 }),
    [client],
  );
  const page = usePaged(fetchPage, []);

  async function handleInvite(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await inviteUser(client, invite);
      setInvite({ email: '', display_name: '', role: 'human_agent' });
      page.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invite failed.');
    } finally {
      setBusy(false);
    }
  }

  async function change(membershipId: string, input: { role?: string; status?: string }): Promise<void> {
    setError(null);
    try {
      await updateMembership(client, membershipId, input);
      page.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Update failed.');
    }
  }

  return (
    <>
      <h1>Users &amp; memberships</h1>
      {error ? <div className="error">{error}</div> : null}
      {page.error ? <div className="error">{page.error}</div> : null}

      <div className="card">
        <form onSubmit={(event) => void handleInvite(event)}>
          <div className="form-row">
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={invite.email}
                onChange={(event) => setInvite({ ...invite, email: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="name">Display name</label>
              <input
                id="name"
                required
                value={invite.display_name}
                onChange={(event) => setInvite({ ...invite, display_name: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={invite.role}
                onChange={(event) => setInvite({ ...invite, role: event.target.value })}
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </div>
            <div style={{ alignSelf: 'end', flex: '0 0 auto' }}>
              <button className="primary" type="submit" disabled={busy}>
                Invite
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Membership</th>
              <th>Identity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((member) => {
              // Mirror of the server rule: nobody edits their own membership.
              const isSelf = member.user_id === claims.sub;
              return (
                <tr key={member.membership_id}>
                  <td>
                    {member.display_name}
                    <div className="muted">{member.email}</div>
                  </td>
                  <td>
                    {isSelf ? (
                      member.role
                    ) : (
                      <select
                        value={member.role}
                        onChange={(event) =>
                          void change(member.membership_id, { role: event.target.value })
                        }
                      >
                        {ASSIGNABLE_ROLES.map((role) => (
                          <option key={role}>{role}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={member.membership_status} />
                  </td>
                  <td>
                    <StatusBadge status={member.user_status} />
                  </td>
                  <td>
                    {isSelf ? (
                      <span className="muted">you</span>
                    ) : member.membership_status === 'disabled' ? (
                      <button onClick={() => void change(member.membership_id, { status: 'active' })}>
                        Enable
                      </button>
                    ) : (
                      <button
                        className="danger"
                        onClick={() => void change(member.membership_id, { status: 'disabled' })}
                      >
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
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
