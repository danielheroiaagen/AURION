import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';

import { getMetricsOverview } from '../api/resources';
import { useAuth } from '../auth/auth-context';

const BADGE_REFRESH_MS = 30_000;

/** App shell: redirects to sign-in when there is no session. */
export function ProtectedLayout(): ReactNode {
  const { session, signOut, client } = useAuth();
  const [pending, setPending] = useState<number | null>(null);

  // Live workload badge (ADR-023). Roles without metrics:read simply see no
  // badge — a 403 here is expected, never an error state.
  useEffect(() => {
    if (!session) {
      return;
    }
    let cancelled = false;
    const refresh = (): void => {
      getMetricsOverview(client, 7)
        .then((overview) => {
          if (!cancelled) {
            setPending(overview.approvals_pending);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPending(null);
          }
        });
    };
    refresh();
    const timer = setInterval(refresh, BADGE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [client, session]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">AURION</div>
        <nav>
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/actions">
            Actions
            {pending !== null && pending > 0 ? (
              <span className="badge warn" style={{ marginLeft: '0.5rem' }}>
                {pending}
              </span>
            ) : null}
          </NavLink>
          <NavLink to="/sessions">Voice sessions</NavLink>
          <NavLink to="/knowledge">Knowledge</NavLink>
          <NavLink to="/users">Users</NavLink>
          <NavLink to="/audit">Audit</NavLink>
          <NavLink to="/tenant">Tenant</NavLink>
        </nav>
        <div className="whoami">
          <div>{session.claims.sub}</div>
          <div>{session.claims.role ?? session.claims.actorType}</div>
          <button onClick={signOut} style={{ marginTop: '0.5rem' }}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
