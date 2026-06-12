import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/auth-context';
import { ProtectedLayout } from './components/layout';
import { ActionsPage } from './pages/actions';
import { AuditPage } from './pages/audit';
import { CallbackPage } from './pages/callback';
import { KnowledgePage } from './pages/knowledge';
import { LoginPage } from './pages/login';
import { OverviewPage } from './pages/overview';
import { SessionDetailPage } from './pages/session-detail';
import { SessionsPage } from './pages/sessions';
import { TenantPage } from './pages/tenant';
import { UsersPage } from './pages/users';

export function App(): ReactNode {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="/actions" element={<ActionsPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/tenant" element={<TenantPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
