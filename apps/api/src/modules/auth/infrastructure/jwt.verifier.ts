import { createHmac, timingSafeEqual } from 'node:crypto';

import { isActorType, type AuthenticatedActor } from '../domain/actor';
import { isRole } from '../domain/roles';

/**
 * Minimal, audited HS256 JWT verifier.
 *
 * The MVP deliberately implements a small, fully-tested verifier over Node's
 * `crypto` instead of pulling a JWT library, keeping the runtime dependency tree
 * (and supply-chain audit surface) minimal — consistent with the project's
 * "no black box" philosophy (ADR-008). Scope is intentionally HS256 only.
 *
 * Documented upgrade path: when an external IdP / asymmetric keys are adopted,
 * swap this for RS256/ES256 with JWKS (a follow-up ADR), keeping this same
 * `JwtVerifier` interface so guards do not change.
 *
 * Security properties enforced:
 *  - Algorithm is pinned to HS256; `none` and any other alg are rejected.
 *  - Signature is compared in constant time.
 *  - `exp` is required; `exp`/`nbf` honored with a small clock skew tolerance.
 *  - Optional issuer/audience are validated when configured.
 */
export interface JwtVerifierOptions {
  readonly secret: string;
  readonly issuer?: string;
  readonly audience?: string;
  /** Allowed clock skew in seconds. Default 60. */
  readonly clockToleranceSec?: number;
  /** Injectable clock for deterministic tests. Returns epoch seconds. */
  readonly now?: () => number;
}

export class JwtVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

interface JwtHeader {
  alg?: string;
  typ?: string;
}

interface JwtClaims {
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

const MIN_SECRET_LENGTH = 32;

export class JwtVerifier {
  private readonly secret: string;
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly clockToleranceSec: number;
  private readonly now: () => number;

  constructor(options: JwtVerifierOptions) {
    if (!options.secret || options.secret.length < MIN_SECRET_LENGTH) {
      throw new JwtVerificationError(
        `JWT secret must be at least ${MIN_SECRET_LENGTH} characters for HS256.`,
      );
    }
    this.secret = options.secret;
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.clockToleranceSec = options.clockToleranceSec ?? 60;
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  /**
   * Verify a compact JWS token and return the normalized actor identity.
   * Throws `JwtVerificationError` on any failure (caller maps to 401).
   */
  verify(token: string): AuthenticatedActor {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new JwtVerificationError('Malformed token.');
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const header = this.decodeJson<JwtHeader>(encodedHeader, 'header');
    if (header.alg !== 'HS256') {
      throw new JwtVerificationError('Unsupported or missing algorithm; expected HS256.');
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expected = createHmac('sha256', this.secret).update(signingInput).digest();
    const provided = this.base64UrlToBuffer(encodedSignature);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new JwtVerificationError('Invalid signature.');
    }

    const claims = this.decodeJson<JwtClaims>(encodedPayload, 'payload');
    this.validateTime(claims);
    this.validateIssuerAudience(claims);

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

  private validateTime(claims: JwtClaims): void {
    if (typeof claims.exp !== 'number') {
      throw new JwtVerificationError('Missing expiration (exp) claim.');
    }
    const now = this.now();
    if (now - this.clockToleranceSec >= claims.exp) {
      throw new JwtVerificationError('Token has expired.');
    }
    if (typeof claims.nbf === 'number' && now + this.clockToleranceSec < claims.nbf) {
      throw new JwtVerificationError('Token is not yet valid.');
    }
  }

  private validateIssuerAudience(claims: JwtClaims): void {
    if (this.issuer && claims.iss !== this.issuer) {
      throw new JwtVerificationError('Invalid issuer (iss) claim.');
    }
    if (this.audience) {
      const aud = claims.aud;
      const matches = Array.isArray(aud) ? aud.includes(this.audience) : aud === this.audience;
      if (!matches) {
        throw new JwtVerificationError('Invalid audience (aud) claim.');
      }
    }
  }

  private decodeJson<T>(segment: string, label: string): T {
    try {
      return JSON.parse(this.base64UrlToBuffer(segment).toString('utf8')) as T;
    } catch {
      throw new JwtVerificationError(`Malformed token ${label}.`);
    }
  }

  private base64UrlToBuffer(segment: string): Buffer {
    if (!/^[A-Za-z0-9_-]*$/.test(segment)) {
      throw new JwtVerificationError('Invalid base64url segment.');
    }
    return Buffer.from(segment, 'base64url');
  }
}
