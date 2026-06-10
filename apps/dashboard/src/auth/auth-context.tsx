import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { ApiClient, ApiError } from '../api/client';
import { getTenant } from '../api/resources';
import { clearSession, loadSession, saveSession, toSession, type Session } from './session';

interface AuthContextValue {
  readonly session: Session | null;
  readonly client: ApiClient;
  signIn(token: string): Promise<void>;
  signOut(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  // One client for the whole app: token read lazily, 401 = session death.
  const client = useMemo(
    () =>
      new ApiClient({
        getToken: () => loadSession()?.token ?? null,
        onUnauthorized: signOut,
      }),
    [signOut],
  );

  const signIn = useCallback(
    async (token: string) => {
      const candidate = toSession(token); // throws SessionError on bad/expired tokens

      // Prove the token against the real API before accepting the session.
      // 401 → invalid; 403 → valid identity whose role lacks tenant:read
      // (still a real session — pages surface their own permissions).
      if (candidate.claims.tenantId) {
        const probe = new ApiClient({ getToken: () => candidate.token });
        try {
          await getTenant(probe, candidate.claims.tenantId);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            throw error;
          }
        }
      }

      saveSession(candidate);
      setSession(candidate);
    },
    [],
  );

  const value = useMemo(
    () => ({ session, client, signIn, signOut }),
    [session, client, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
