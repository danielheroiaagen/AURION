import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginSignIn,
  completeSignIn,
  consumeAttempt,
  loadOidcConfig,
  OidcError,
  redirectUri,
} from '../src/auth/oidc';
import { computeCodeChallenge, generateCodeVerifier, generateState } from '../src/auth/pkce';

const CONFIG = {
  authorizationUrl: 'https://idp.example.test/authorize',
  tokenUrl: 'https://idp.example.test/oauth/token',
  clientId: 'aurion-dashboard',
  scope: 'openid profile',
  audience: 'aurion-api',
};

const ORIGIN = 'https://admin.aurion.test';

describe('PKCE primitives', () => {
  it('S256 challenge matches the RFC 7636 appendix B test vector', async () => {
    expect(await computeCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('verifiers and state are random, long enough, and base64url-safe', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateCodeVerifier()).not.toBe(verifier);
    expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('loadOidcConfig', () => {
  it('returns null when nothing is configured (token-paste-only mode)', () => {
    expect(loadOidcConfig({})).toBeNull();
  });

  it('fails closed on partial or non-https configuration', () => {
    expect(() =>
      loadOidcConfig({ VITE_OIDC_AUTHORIZATION_URL: 'https://idp/authorize' }),
    ).toThrow(OidcError);
    expect(() =>
      loadOidcConfig({
        VITE_OIDC_AUTHORIZATION_URL: 'http://idp/authorize',
        VITE_OIDC_TOKEN_URL: 'https://idp/token',
        VITE_OIDC_CLIENT_ID: 'x',
      }),
    ).toThrow(/https/);
  });
});

describe('sign-in attempt lifecycle', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('builds the authorization redirect with PKCE S256 and stores the attempt', async () => {
    const url = new URL(await beginSignIn(CONFIG, ORIGIN));
    expect(url.origin + url.pathname).toBe(CONFIG.authorizationUrl);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe(CONFIG.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri(ORIGIN));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('audience')).toBe('aurion-api');

    const attempt = consumeAttempt();
    expect(attempt?.state).toBe(url.searchParams.get('state'));
    // The challenge in the URL derives from the stored verifier.
    expect(url.searchParams.get('code_challenge')).toBe(
      await computeCodeChallenge(attempt!.verifier),
    );
  });

  it('attempts are single-use', async () => {
    await beginSignIn(CONFIG, ORIGIN);
    expect(consumeAttempt()).not.toBeNull();
    expect(consumeAttempt()).toBeNull();
  });
});

describe('completeSignIn', () => {
  beforeEach(() => window.sessionStorage.clear());

  function tokenResponse(status: number, body: unknown): Response {
    return { ok: status < 300, status, json: async () => body } as unknown as Response;
  }

  async function startedAttempt(): Promise<string> {
    const url = new URL(await beginSignIn(CONFIG, ORIGIN));
    return url.searchParams.get('state')!;
  }

  it('rejects state mismatches BEFORE any network call', async () => {
    await startedAttempt();
    const fetchImpl = vi.fn();
    await expect(
      completeSignIn(
        CONFIG,
        new URLSearchParams({ code: 'abc', state: 'forged' }),
        ORIGIN,
        window.sessionStorage,
        fetchImpl,
      ),
    ).rejects.toThrow(/does not match/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects callbacks with no stored attempt (replay protection)', async () => {
    const fetchImpl = vi.fn();
    await expect(
      completeSignIn(
        CONFIG,
        new URLSearchParams({ code: 'abc', state: 'whatever' }),
        ORIGIN,
        window.sessionStorage,
        fetchImpl,
      ),
    ).rejects.toThrow(OidcError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('exchanges the code with the verifier and no client secret', async () => {
    const state = await startedAttempt();
    const fetchImpl = vi.fn().mockResolvedValue(tokenResponse(200, { access_token: 'jwt-123' }));

    const token = await completeSignIn(
      CONFIG,
      new URLSearchParams({ code: 'auth-code', state }),
      ORIGIN,
      window.sessionStorage,
      fetchImpl,
    );
    expect(token).toBe('jwt-123');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(CONFIG.tokenUrl);
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('code_verifier')).toBeTruthy();
    expect(body.get('client_id')).toBe(CONFIG.clientId);
    expect(body.get('client_secret')).toBeNull();
  });

  it('surfaces IdP errors and malformed token responses as sign-in errors', async () => {
    const state = await startedAttempt();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(tokenResponse(400, { error_description: 'invalid_grant: code expired' }));
    await expect(
      completeSignIn(
        CONFIG,
        new URLSearchParams({ code: 'expired', state }),
        ORIGIN,
        window.sessionStorage,
        fetchImpl,
      ),
    ).rejects.toThrow(/code expired/);

    await beginSignIn(CONFIG, ORIGIN);
    await expect(
      completeSignIn(
        CONFIG,
        new URLSearchParams({ error: 'access_denied' }),
        ORIGIN,
        window.sessionStorage,
        vi.fn(),
      ),
    ).rejects.toThrow(/access_denied/);
  });
});
