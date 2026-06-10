import type { AuthenticatedActor } from '../domain/actor';

/**
 * Authentication seam (ADR-007, ADR-016): the auth guard depends on this
 * port, not on a concrete verifier, so symmetric (HS256) and asymmetric
 * (RS256 + JWKS) verification are interchangeable at startup. The guard
 * awaits the result; implementations may be sync or async.
 */
export interface TokenVerifier {
  /** Returns the normalized actor or throws `JwtVerificationError` (→ 401). */
  verify(token: string): AuthenticatedActor | Promise<AuthenticatedActor>;
}

/** DI token for the token verifier port. */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
