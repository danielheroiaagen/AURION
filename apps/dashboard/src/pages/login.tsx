import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';
import { beginSignIn, loadOidcConfig, type OidcConfig } from '../auth/oidc';

/**
 * Sign-in (ADR-017/ADR-021). With OIDC configured, the primary path is the
 * Authorization Code + PKCE redirect; manual token paste stays available as
 * the explicit dev/hs256 fallback. Both paths converge on the same
 * validated signIn() door.
 */
export function LoginPage(): ReactNode {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let oidcConfig: OidcConfig | null = null;
  let oidcConfigError: string | null = null;
  try {
    oidcConfig = loadOidcConfig(import.meta.env);
  } catch (cause) {
    oidcConfigError = cause instanceof Error ? cause.message : 'Invalid OIDC configuration.';
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleOidc(): Promise<void> {
    if (!oidcConfig) {
      return;
    }
    setBusy(true);
    window.location.assign(await beginSignIn(oidcConfig, window.location.origin));
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(token);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="card">
        <h1>AURION — Admin</h1>
        {oidcConfigError ? <div className="error">{oidcConfigError}</div> : null}
        {oidcConfig ? (
          <div style={{ marginBottom: '1rem' }}>
            <button className="primary" disabled={busy} onClick={() => void handleOidc()}>
              Sign in with your identity provider
            </button>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Or paste a token manually (development fallback):
            </p>
          </div>
        ) : (
          <p className="muted">
            Paste an access token for your tenant. The token is held in this tab
            only and dies when you close it.
          </p>
        )}
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="token">Access token</label>
          <textarea
            id="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="eyJhbGciOi..."
            required
          />
          <div style={{ marginTop: '0.75rem' }}>
            <button className="primary" type="submit" disabled={busy || token.trim().length === 0}>
              {busy ? 'Validating…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
