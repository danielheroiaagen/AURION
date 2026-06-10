import { createHmac, timingSafeEqual } from 'node:crypto';

import type { TokenVerifier } from '../application/token-verifier.port';
import type { AuthenticatedActor } from '../domain/actor';
import {
  base64UrlToBuffer,
  decodeSegmentJson,
  JwtVerificationError,
  toAuthenticatedActor,
  validateIssuerAudience,
  validateTimeClaims,
  type JwtClaims,
} from './jwt-claims';

export { JwtVerificationError };

/**
 * Minimal, audited HS256 JWT verifier.
 *
 * The MVP deliberately implements a small, fully-tested verifier over Node's
 * `crypto` instead of pulling a JWT library, keeping the runtime dependency tree
 * (and supply-chain audit surface) minimal — consistent with the project's
 * "no black box" philosophy (ADR-008). Scope is intentionally HS256 only;
 * the asymmetric production path is `JwksJwtVerifier` (ADR-016), selected by
 * `AUTH_MODE`. Both implement the same `TokenVerifier` port and share the
 * claim contract in `jwt-claims.ts`.
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

interface JwtHeader {
  alg?: string;
  typ?: string;
}

const MIN_SECRET_LENGTH = 32;

export class JwtVerifier implements TokenVerifier {
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

    const header = decodeSegmentJson<JwtHeader>(encodedHeader, 'header');
    if (header.alg !== 'HS256') {
      throw new JwtVerificationError('Unsupported or missing algorithm; expected HS256.');
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expected = createHmac('sha256', this.secret).update(signingInput).digest();
    const provided = base64UrlToBuffer(encodedSignature);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new JwtVerificationError('Invalid signature.');
    }

    const claims = decodeSegmentJson<JwtClaims>(encodedPayload, 'payload');
    validateTimeClaims(claims, this.now(), this.clockToleranceSec);
    validateIssuerAudience(claims, this.issuer, this.audience);
    return toAuthenticatedActor(claims);
  }
}
