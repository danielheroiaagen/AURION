import { computeCodeChallenge, generateCodeVerifier, generateState } from './pkce';

/**
 * OIDC Authorization Code + PKCE as a PUBLIC client (ADR-021): explicit
 * endpoint configuration (no discovery fetch), no client secret anywhere,
 * single-use transient attempt state. The resulting access token enters the
 * session through the same validated `signIn()` door as a pasted token.
 */
export interface OidcConfig {
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly scope: string;
  readonly audience?: string;
}

export class OidcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OidcError';
  }
}

interface ViteEnvLike {
  readonly VITE_OIDC_AUTHORIZATION_URL?: string;
  readonly VITE_OIDC_TOKEN_URL?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_SCOPE?: string;
  readonly VITE_OIDC_AUDIENCE?: string;
}

/** Null when OIDC is not configured → the login page offers token paste only. */
export function loadOidcConfig(env: ViteEnvLike): OidcConfig | null {
  const { VITE_OIDC_AUTHORIZATION_URL, VITE_OIDC_TOKEN_URL, VITE_OIDC_CLIENT_ID } = env;
  if (!VITE_OIDC_AUTHORIZATION_URL && !VITE_OIDC_TOKEN_URL && !VITE_OIDC_CLIENT_ID) {
    return null;
  }
  if (!VITE_OIDC_AUTHORIZATION_URL?.startsWith('https://')) {
    throw new OidcError('VITE_OIDC_AUTHORIZATION_URL must be an https URL.');
  }
  if (!VITE_OIDC_TOKEN_URL?.startsWith('https://')) {
    throw new OidcError('VITE_OIDC_TOKEN_URL must be an https URL.');
  }
  if (!VITE_OIDC_CLIENT_ID) {
    throw new OidcError('VITE_OIDC_CLIENT_ID is required when OIDC is configured.');
  }
  return {
    authorizationUrl: VITE_OIDC_AUTHORIZATION_URL,
    tokenUrl: VITE_OIDC_TOKEN_URL,
    clientId: VITE_OIDC_CLIENT_ID,
    scope: env.VITE_OIDC_SCOPE || 'openid profile',
    audience: env.VITE_OIDC_AUDIENCE || undefined,
  };
}

const ATTEMPT_KEY = 'aurion.oidc.attempt';

interface Attempt {
  readonly verifier: string;
  readonly state: string;
}

export function redirectUri(origin: string): string {
  return `${origin}/callback`;
}

/** Build the authorization redirect and persist the single-use attempt. */
export async function beginSignIn(
  config: OidcConfig,
  origin: string,
  storage: Storage = window.sessionStorage,
): Promise<string> {
  const verifier = generateCodeVerifier();
  const state = generateState();
  storage.setItem(ATTEMPT_KEY, JSON.stringify({ verifier, state } satisfies Attempt));

  const url = new URL(config.authorizationUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri(origin));
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', await computeCodeChallenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  if (config.audience) {
    url.searchParams.set('audience', config.audience);
  }
  return url.toString();
}

/** Read AND consume the attempt: a callback can be honored at most once. */
export function consumeAttempt(storage: Storage = window.sessionStorage): Attempt | null {
  const raw = storage.getItem(ATTEMPT_KEY);
  storage.removeItem(ATTEMPT_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Attempt;
    return typeof parsed.verifier === 'string' && typeof parsed.state === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Validate the callback against the stored attempt (BEFORE any network
 * call) and exchange the code for an access token.
 */
export async function completeSignIn(
  config: OidcConfig,
  params: URLSearchParams,
  origin: string,
  storage: Storage = window.sessionStorage,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const attempt = consumeAttempt(storage);
  const idpError = params.get('error');
  if (idpError) {
    throw new OidcError(`Identity provider returned: ${idpError}.`);
  }
  const code = params.get('code');
  const state = params.get('state');
  if (!attempt || !code || !state || state !== attempt.state) {
    throw new OidcError('Sign-in attempt does not match this callback. Start again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: attempt.verifier,
    redirect_uri: redirectUri(origin),
    client_id: config.clientId,
  });
  const response = await fetchImpl(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // handled below
  }
  if (!response.ok || payload === null || typeof payload !== 'object') {
    const description =
      payload && typeof payload === 'object' && 'error_description' in payload
        ? String((payload as { error_description: unknown }).error_description)
        : `Token endpoint responded ${response.status}.`;
    throw new OidcError(description);
  }
  const accessToken = (payload as { access_token?: unknown }).access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new OidcError('Token endpoint returned no access_token.');
  }
  return accessToken;
}
