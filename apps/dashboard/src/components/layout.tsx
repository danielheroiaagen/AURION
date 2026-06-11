import {
  Activity,
  BookOpen,
  Building2,
  CheckSquare,
  LayoutDashboard,
  Phone,
  ScrollText,
  Users,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';

import { getMetricsOverview } from '../api/resources';
import { useAuth } from '../auth/auth-context';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const BADGE_REFRESH_MS = 30_000;

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/actions', label: 'Actions', icon: CheckSquare },
  { to: '/sessions', label: 'Voice sessions', icon: Phone },
  { to: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/audit', label: 'Audit', icon: ScrollText },
  { to: '/tenant', label: 'Tenant', icon: Building2 },
] as const;

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
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink key={to} to={to} end={'end' in rest ? rest.end : undefined}>
              <Icon aria-hidden />
              {label}
              {to === '/actions' && pending !== null && pending > 0 ? (
                <Badge tone="warn" className="ml-auto">
                  {pending}
                </Badge>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="whoami">
          <div className="flex items-center gap-1.5 text-(--color-ok)">
            <Activity className="size-3" aria-hidden />
            <span className="text-[0.7rem] font-semibold uppercase tracking-wider">live</span>
          </div>
          <div className="mt-1.5">{session.claims.sub}</div>
          <div>{session.claims.role ?? session.claims.actorType}</div>
          <Button variant="ghost" size="sm" onClick={signOut} className="mt-2 -ml-1.5">
            Sign out
          </Button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
