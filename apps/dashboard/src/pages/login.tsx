import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';

/**
 * MVP sign-in (ADR-017): the operator provides a bearer token issued out of
 * band (dev token in hs256 mode, IdP token in jwks mode). The session layer
 * validates shape + expiry and proves the token against the API before
 * accepting it. The OIDC PKCE flow replaces this screen in a later phase.
 */
export function LoginPage(): ReactNode {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return <Navigate to="/" replace />;
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
        <p className="muted">
          Paste an access token for your tenant. The token is held in this tab
          only and dies when you close it.
        </p>
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
