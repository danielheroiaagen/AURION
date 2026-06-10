import type { ReactNode } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';

/** App shell: redirects to sign-in when there is no session. */
export function ProtectedLayout(): ReactNode {
  const { session, signOut } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">AURION</div>
        <nav>
          <NavLink to="/actions">Actions</NavLink>
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
