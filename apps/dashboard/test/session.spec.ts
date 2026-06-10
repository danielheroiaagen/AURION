import { describe, expect, it } from 'vitest';

import {
  clearSession,
  decodeClaims,
  isExpired,
  loadSession,
  saveSession,
  SessionError,
  toSession,
} from '../src/auth/session';

const NOW = Math.floor(Date.now() / 1000);

function b64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(payload: Record<string, unknown>): string {
  return `${b64url(JSON.stringify({ alg: 'HS256' }))}.${b64url(JSON.stringify(payload))}.sig`;
}

const VALID = makeToken({
  sub: 'user-1',
  tenant_id: 'tenant-1',
  role: 'tenant_admin',
  actor_type: 'user',
  exp: NOW + 600,
});

describe('session claims', () => {
  it('decodes the claims the dashboard displays', () => {
    expect(decodeClaims(VALID)).toEqual({
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'tenant_admin',
      actorType: 'user',
      exp: expect.any(Number),
    });
  });

  it('rejects malformed tokens and missing sub/exp', () => {
    expect(() => decodeClaims('not-a-jwt')).toThrow(SessionError);
    expect(() => decodeClaims(makeToken({ exp: NOW + 600 }))).toThrow(/sub/);
    expect(() => decodeClaims(makeToken({ sub: 'u' }))).toThrow(/exp/);
  });

  it('refuses expired tokens at sign-in', () => {
    expect(isExpired({ sub: 'u', tenantId: null, role: null, actorType: 'user', exp: NOW - 1 })).toBe(
      true,
    );
    expect(() => toSession(makeToken({ sub: 'u', exp: NOW - 10 }))).toThrow(/expired/);
  });
});

describe('session storage', () => {
  it('persists in sessionStorage and drops unusable stored tokens', () => {
    const session = toSession(VALID);
    saveSession(session);
    expect(loadSession()?.claims.sub).toBe('user-1');

    clearSession();
    expect(loadSession()).toBeNull();

    window.sessionStorage.setItem('aurion.dashboard.token', 'garbage');
    expect(loadSession()).toBeNull();
    // A bad stored token must self-clean, not loop forever.
    expect(window.sessionStorage.getItem('aurion.dashboard.token')).toBeNull();
  });
});
