---
project: AURION
document: Phase 6 External IdP & OpenAPI Artifact Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-10
related: ADR-007, ADR-009, ADR-014, ADR-016
---

# Phase 6 — External IdP & OpenAPI artifact

Phase 6 makes the backend production-grade on the two remaining axes: trust
(asymmetric token verification against an external IdP, `ADR-016`) and
contract visibility (the OpenAPI document `ADR-009` designated as the review
artifact finally exists as a generated, drift-checked file). It also closes
two long-pending repo items: the HERMES receiver-side contract is documented,
and the `integration` job becomes a required status check on `main`.

## Work units

1. `ADR-016`, this plan, and
   `29_HERMES_AGENT_WORKFORCE/dispatch-receiver-contract.md` (receiver-side
   obligations: signature-before-parse, 300s staleness window, `action_id`
   dedupe, 2xx JSON = evidence).
2. Auth (`ADR-016`):
   - `security.config.ts`: discriminated `auth` config — `hs256` (default,
     `JWT_SECRET` required) | `jwks` (fail-closed on missing https
     `AUTH_JWKS_URL`, `JWT_ISSUER`, `JWT_AUDIENCE`).
   - Shared `jwt-claims.ts` (time/issuer/audience validation + actor
     normalization) used by both verifiers — one claim contract, two
     signature schemes.
   - `JwksJwtVerifier`: RS256 pinned, `kid`-cached JWKS with TTL,
     cooldown-limited refresh on unknown `kid`, AbortController fetch
     timeout, `node:crypto` only.
   - `TOKEN_VERIFIER` port; `JwtAuthGuard` awaits, mode selected at startup.
3. OpenAPI artifact: `apps/api/src/openapi/generate-openapi.ts` writes
   `32_API_REFERENCE/openapi.json` (committed); `npm run openapi:generate`;
   CI `verify` regenerates and fails on drift (`git diff --exit-code`).
4. Branch protection: add `integration` to the required status checks on
   `main` (GitHub REST).
5. Tests: Jest unit suites (JWKS verifier against a real in-test RSA
   keypair: signature, alg confusion, expiry, rotation, unknown-kid
   cooldown, fetch failure fallback; auth config fail-closed matrix);
   Python contract tests `tests/project/test_phase6_idp_openapi.py`.
6. Docs and wiring: `.env.example`, CHANGELOG, root scripts.

## Acceptance criteria

- [x] `AUTH_MODE=jwks` refuses to start without https JWKS URL + pinned
      issuer + audience; RS256 is the only accepted algorithm in jwks mode;
      HS256 tokens (key confusion) and `alg: none` are rejected.
- [x] Key rotation works without restart (new `kid` picked up via
      cooldown-limited refetch); a flood of bogus `kid`s cannot DoS the
      JWKS endpoint through the API.
- [x] `32_API_REFERENCE/openapi.json` is generated from the real Nest app,
      committed, and CI fails when the committed artifact drifts from code.
- [x] `integration` is a required status check on `main` (verified via the
      branch-protection API: verify, dependency-audit, secret-scan,
      integration).
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope (later phases)

- OIDC discovery, token issuance/refresh flows, ES256/EdDSA.
- IdP-specific onboarding guides (chosen-IdP claim mapping, M2M clients).
- Published SDK generation from the OpenAPI artifact.

## Closure evidence

Local verification passed on branch `phase-6/idp-openapi` (2026-06-10):

- [x] `npm test` passed: **125** Python contract tests (15 new for phase 6).
- [x] `npm run test:api` passed: **126** Jest unit tests (12 suites),
      including the JWKS suite against a real in-test RSA keypair
      (signature, algorithm confusion, expiry/issuer/audience pinning,
      restart-free rotation, bogus-kid cooldown, endpoint-down fallback,
      empty-cache fail-closed).
- [x] `npm run test:api:integration` passed against a disposable
      `postgres:16` container: **21** integration tests (3 suites).
- [x] `npm run openapi:generate` produced `32_API_REFERENCE/openapi.json`
      covering all six ADR-009 contract groups (18 routes).
- [x] `npm --workspace @aurion/api run typecheck` and `build` passed.
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification: pending PR.
