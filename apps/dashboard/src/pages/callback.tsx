import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';
import { completeSignIn, loadOidcConfig } from '../auth/oidc';

/**
 * OIDC redirect target (ADR-021): state is validated against the stored
 * single-use attempt BEFORE any network call; the exchanged access token
 * then enters through the same validated signIn() door as a pasted token.
 */
export function CallbackPage(): ReactNode {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return; // StrictMode double-invoke: the attempt is single-use.
    }
    ran.current = true;
    void (async () => {
      try {
        const config = loadOidcConfig(import.meta.env);
        if (!config) {
          throw new Error('OIDC is not configured for this deployment.');
        }
        const token = await completeSignIn(
          config,
          new URLSearchParams(window.location.search),
          window.location.origin,
        );
        await signIn(token);
        navigate('/', { replace: true });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
      }
    })();
  }, [signIn, navigate]);

  return (
    <div className="login">
      <div className="card">
        <h1>Signing you in…</h1>
        {error ? (
          <>
            <div className="error">{error}</div>
            <Link to="/login">Back to sign-in</Link>
          </>
        ) : (
          <p className="muted">Validating your identity provider response.</p>
        )}
      </div>
    </div>
  );
}
