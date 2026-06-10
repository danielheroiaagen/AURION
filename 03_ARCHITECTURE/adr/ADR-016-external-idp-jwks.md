---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-007, ADR-009, ADR-010
---

# ADR-016 — External IdP: RS256 + JWKS token verification

## Decision

AURION supports asymmetric token verification against an external identity
provider, selected by `AUTH_MODE`:

- **`hs256`** (default) — the existing symmetric verifier (ADR-007 MVP):
  `JWT_SECRET` required, algorithm pinned to HS256.
- **`jwks`** — production mode for an external IdP (Auth0, Keycloak, Entra,
  any OIDC-compliant issuer): tokens are RS256, verified against the
  issuer's JWKS endpoint. Fail closed: the API refuses to start without
  `AUTH_JWKS_URL` (https), **and pinned `JWT_ISSUER` and `JWT_AUDIENCE`** —
  with a third-party issuer, accepting tokens without pinning both is an
  account-takeover primitive, so they are not optional in this mode.

Verification stays dependency-free (`node:crypto`), consistent with the
"no black box" philosophy of the HS256 verifier: RSA keys are imported from
JWK format natively (`createPublicKey({ format: 'jwk' })`) and signatures
checked with `crypto.verify`. No JWT library enters the supply chain.

## Context

The HS256 verifier (phase 2) documented exactly this upgrade path: *"when an
external IdP / asymmetric keys are adopted, swap this for RS256/ES256 with
JWKS, keeping this same verifier interface so guards do not change."*
A symmetric secret shared between the IdP and every API instance is the wrong
trust model for production: anyone who can verify can also mint. Asymmetric
verification removes the minting capability from the API fleet entirely.

## Design

### Verifier port

`TokenVerifier` is the seam the auth guard depends on
(`TOKEN_VERIFIER` DI token):

```ts
interface TokenVerifier {
  verify(token: string): AuthenticatedActor | Promise<AuthenticatedActor>;
}
```

The guard awaits the result, so the synchronous HS256 verifier and the
asynchronous JWKS verifier are interchangeable. Claim semantics are shared
code (`jwt-claims.ts`), not duplicated: `sub` required, `exp` required,
`nbf`/skew honored, `tenant_id`/`role`/`actor_type` normalized into the same
`AuthenticatedActor` both modes produce. A token that authenticates in one
mode carries identical authority in the other.

### JWKS key management (`JwksJwtVerifier`)

- **Algorithm pinning**: header `alg` must be exactly `RS256`; `none`, HS256
  (key-confusion attacks) and everything else are rejected before any key
  lookup. `kid` is required.
- **Key cache**: keys are fetched from `AUTH_JWKS_URL` and cached in-process
  by `kid` for `AUTH_JWKS_CACHE_SECONDS` (default 600). Only RSA keys usable
  for signatures are accepted from the document.
- **Rotation**: an unknown `kid` triggers one refetch — rate-limited by a
  cooldown (default 60s) so a flood of bogus-`kid` tokens cannot turn the
  API into a JWKS-endpoint DoS cannon. After a refresh, an unknown `kid` is
  a verification failure (401), never an error.
- **Fetch discipline**: https endpoint, `AbortController` timeout (default
  5s). A failed fetch falls back to cached keys when present; with no cache,
  verification fails closed (401).

### What does NOT change

- Authorization is untouched: the policy decision point, permission matrix,
  tenant scoping and approval gates consume the same `AuthenticatedActor`.
- Token claim contract (`sub`, `tenant_id`, `role`, `actor_type`) is the
  same; the IdP must be configured to emit these claims (action/claim-mapping
  on the IdP side).

## Consequences

- Production deployments set `AUTH_MODE=jwks`; the symmetric secret
  disappears from production environments entirely. `hs256` remains for
  local development and tests.
- IdP onboarding (tenant claim mapping, machine-to-machine clients for the
  voice agent runtime) is operational configuration, documented per-IdP when
  one is chosen — this ADR fixes the API-side contract only.
- ES256/EdDSA can be added later inside `JwksJwtVerifier` (same port); not
  needed until an IdP requires it.
- Out of scope: token issuance, refresh flows, OIDC discovery
  (`/.well-known/openid-configuration` auto-resolution — the JWKS URL is
  configured explicitly), and per-request key pinning.
