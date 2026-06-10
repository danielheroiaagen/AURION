import { createPublicKey, verify as cryptoVerify, type KeyObject } from 'node:crypto';

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

/**
 * RS256 verifier against an external IdP's JWKS endpoint (ADR-016).
 *
 * Dependency-free by design: RSA keys are imported from JWK natively via
 * `node:crypto` and signatures checked with `crypto.verify` — the same
 * "no black box" stance as the HS256 verifier.
 *
 * Security properties enforced:
 *  - Algorithm pinned to RS256; `none`, HS256 (key-confusion) and everything
 *    else are rejected before any key lookup. `kid` is required.
 *  - Issuer and audience are ALWAYS validated (the config layer guarantees
 *    both are set — an unpinned third-party issuer is account takeover).
 *  - Keys are cached by `kid` with a TTL; an unknown `kid` triggers at most
 *    one refetch per cooldown window, so bogus-kid floods cannot turn the
 *    API into a JWKS-endpoint DoS cannon.
 *  - JWKS fetches time out via AbortController; on fetch failure, cached
 *    keys keep working and an empty cache fails closed (401).
 */
export interface JwksVerifierOptions {
  readonly jwksUrl: string;
  readonly issuer: string;
  readonly audience: string;
  /** Cache lifetime for fetched keys, seconds. Default 600. */
  readonly cacheTtlSec?: number;
  /** Minimum spacing between JWKS refetches, seconds. Default 60. */
  readonly refreshCooldownSec?: number;
  /** JWKS fetch timeout, milliseconds. Default 5000. */
  readonly fetchTimeoutMs?: number;
  /** Allowed clock skew in seconds. Default 60. */
  readonly clockToleranceSec?: number;
  /** Injectable clock for deterministic tests. Returns epoch seconds. */
  readonly now?: () => number;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface JwkLike {
  kty?: string;
  kid?: string;
  use?: string;
  alg?: string;
  [key: string]: unknown;
}

export class JwksJwtVerifier implements TokenVerifier {
  private readonly options: Required<
    Pick<
      JwksVerifierOptions,
      'cacheTtlSec' | 'refreshCooldownSec' | 'fetchTimeoutMs' | 'clockToleranceSec'
    >
  > &
    JwksVerifierOptions;

  private readonly now: () => number;
  private keys = new Map<string, KeyObject>();
  private fetchedAtSec = 0;
  private lastAttemptSec = 0;

  constructor(options: JwksVerifierOptions) {
    this.options = {
      cacheTtlSec: 600,
      refreshCooldownSec: 60,
      fetchTimeoutMs: 5000,
      clockToleranceSec: 60,
      ...options,
    };
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async verify(token: string): Promise<AuthenticatedActor> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new JwtVerificationError('Malformed token.');
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const header = decodeSegmentJson<JwtHeader>(encodedHeader, 'header');
    if (header.alg !== 'RS256') {
      throw new JwtVerificationError('Unsupported or missing algorithm; expected RS256.');
    }
    if (!header.kid || typeof header.kid !== 'string') {
      throw new JwtVerificationError('Missing key id (kid) header.');
    }

    const key = await this.getKey(header.kid);
    const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8');
    const signature = base64UrlToBuffer(encodedSignature);
    if (!cryptoVerify('RSA-SHA256', signingInput, key, signature)) {
      throw new JwtVerificationError('Invalid signature.');
    }

    const claims = decodeSegmentJson<JwtClaims>(encodedPayload, 'payload');
    validateTimeClaims(claims, this.now(), this.options.clockToleranceSec);
    validateIssuerAudience(claims, this.options.issuer, this.options.audience);
    return toAuthenticatedActor(claims);
  }

  private async getKey(kid: string): Promise<KeyObject> {
    const nowSec = this.now();
    const cacheFresh = nowSec - this.fetchedAtSec < this.options.cacheTtlSec;

    if (!this.keys.has(kid) || !cacheFresh) {
      await this.refresh(nowSec);
    }

    const key = this.keys.get(kid);
    if (!key) {
      throw new JwtVerificationError('Unknown signing key.');
    }
    return key;
  }

  /**
   * Refetch the JWKS document, at most once per cooldown window. A failed
   * fetch keeps the previous cache (stale keys beat no keys); the caller
   * fails closed when the kid still cannot be resolved.
   */
  private async refresh(nowSec: number): Promise<void> {
    if (nowSec - this.lastAttemptSec < this.options.refreshCooldownSec) {
      return;
    }
    this.lastAttemptSec = nowSec;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.fetchTimeoutMs);
    try {
      const response = await fetch(this.options.jwksUrl, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { keys?: JwkLike[] };
      if (!Array.isArray(body.keys)) {
        return;
      }

      const next = new Map<string, KeyObject>();
      for (const jwk of body.keys) {
        if (jwk.kty !== 'RSA' || !jwk.kid) {
          continue;
        }
        if (jwk.use && jwk.use !== 'sig') {
          continue;
        }
        if (jwk.alg && jwk.alg !== 'RS256') {
          continue;
        }
        try {
          next.set(jwk.kid, createPublicKey({ key: jwk as never, format: 'jwk' }));
        } catch {
          // A malformed key in the document must not poison the valid ones.
        }
      }
      this.keys = next;
      this.fetchedAtSec = nowSec;
    } catch {
      // Network failure / timeout: keep serving from the existing cache.
    } finally {
      clearTimeout(timer);
    }
  }
}
