/**
 * Session layer (ADR-017).
 *
 * The bearer token lives in `sessionStorage` only: it dies with the tab,
 * never touches `localStorage` (no cross-tab persistence of credentials)
 * and never becomes a cookie (no CSRF surface).
 *
 * Claims decoded here are UX hints — what to display, which buttons to
 * offer. They are NEVER authority: every privilege is enforced server-side
 * by the policy decision point, and any 401 kills the session.
 */
export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export interface SessionClaims {
  readonly sub: string;
  readonly tenantId: string | null;
  readonly role: string | null;
  readonly actorType: string;
  readonly exp: number;
}

export interface Session {
  readonly token: string;
  readonly claims: SessionClaims;
}

const STORAGE_KEY = 'aurion.dashboard.token';

function decodeBase64Url(segment: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(segment)) {
    throw new SessionError('Malformed token segment.');
  }
  const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

export function decodeClaims(token: string): SessionClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new SessionError('A JWT has three dot-separated segments.');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
  } catch {
    throw new SessionError('Token payload is not valid JSON.');
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new SessionError('Token has no subject (sub) claim.');
  }
  if (typeof payload.exp !== 'number') {
    throw new SessionError('Token has no expiration (exp) claim.');
  }

  return {
    sub: payload.sub,
    tenantId: typeof payload.tenant_id === 'string' ? payload.tenant_id : null,
    role: typeof payload.role === 'string' ? payload.role : null,
    actorType: typeof payload.actor_type === 'string' ? payload.actor_type : 'user',
    exp: payload.exp,
  };
}

export function isExpired(claims: SessionClaims, nowEpochSec = Math.floor(Date.now() / 1000)): boolean {
  return nowEpochSec >= claims.exp;
}

/** Decode + expiry check; throws `SessionError` on anything unusable. */
export function toSession(token: string): Session {
  const claims = decodeClaims(token.trim());
  if (isExpired(claims)) {
    throw new SessionError('Token has expired.');
  }
  return { token: token.trim(), claims };
}

export function loadSession(storage: Storage = window.sessionStorage): Session | null {
  const token = storage.getItem(STORAGE_KEY);
  if (!token) {
    return null;
  }
  try {
    return toSession(token);
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: Session, storage: Storage = window.sessionStorage): void {
  storage.setItem(STORAGE_KEY, session.token);
}

export function clearSession(storage: Storage = window.sessionStorage): void {
  storage.removeItem(STORAGE_KEY);
}
