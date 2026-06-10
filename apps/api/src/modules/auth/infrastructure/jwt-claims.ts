import { isActorType, type AuthenticatedActor } from '../domain/actor';
import { isRole } from '../domain/roles';

/**
 * Claim contract shared by every token verifier (ADR-007, ADR-016).
 *
 * Both the HS256 and the JWKS/RS256 verifiers normalize tokens through these
 * helpers, so a token that authenticates in one mode carries IDENTICAL
 * authority in the other — the signature scheme changes, the claim semantics
 * never do.
 */
export class JwtVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

export interface JwtClaims {
  sub?: string;
  tenant_id?: string;
  role?: string;
  actor_type?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
}

export function base64UrlToBuffer(segment: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(segment)) {
    throw new JwtVerificationError('Invalid base64url segment.');
  }
  return Buffer.from(segment, 'base64url');
}

export function decodeSegmentJson<T>(segment: string, label: string): T {
  try {
    return JSON.parse(base64UrlToBuffer(segment).toString('utf8')) as T;
  } catch {
    throw new JwtVerificationError(`Malformed token ${label}.`);
  }
}

export function validateTimeClaims(
  claims: JwtClaims,
  nowEpochSec: number,
  clockToleranceSec: number,
): void {
  if (typeof claims.exp !== 'number') {
    throw new JwtVerificationError('Missing expiration (exp) claim.');
  }
  if (nowEpochSec - clockToleranceSec >= claims.exp) {
    throw new JwtVerificationError('Token has expired.');
  }
  if (typeof claims.nbf === 'number' && nowEpochSec + clockToleranceSec < claims.nbf) {
    throw new JwtVerificationError('Token is not yet valid.');
  }
}

export function validateIssuerAudience(
  claims: JwtClaims,
  issuer?: string,
  audience?: string,
): void {
  if (issuer && claims.iss !== issuer) {
    throw new JwtVerificationError('Invalid issuer (iss) claim.');
  }
  if (audience) {
    const aud = claims.aud;
    const matches = Array.isArray(aud) ? aud.includes(audience) : aud === audience;
    if (!matches) {
      throw new JwtVerificationError('Invalid audience (aud) claim.');
    }
  }
}

export function toAuthenticatedActor(claims: JwtClaims): AuthenticatedActor {
  if (!claims.sub) {
    throw new JwtVerificationError('Missing subject (sub) claim.');
  }

  const actorType = claims.actor_type ?? 'user';
  if (!isActorType(actorType)) {
    throw new JwtVerificationError('Invalid actor_type claim.');
  }

  const role = claims.role ?? null;
  if (role !== null && !isRole(role)) {
    throw new JwtVerificationError('Invalid role claim.');
  }

  return {
    id: claims.sub,
    tenantId: claims.tenant_id ?? null,
    type: actorType,
    role,
  };
}
