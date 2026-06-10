---
project: AURION
document: Phase 11 Dashboard OIDC PKCE Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-10
related: ADR-016, ADR-017, ADR-021
---

# Phase 11 — Dashboard OIDC PKCE sign-in

Phase 11 replaces the manual-token MVP sign-in with the real thing
(`ADR-021`): Authorization Code + PKCE against the external IdP, public
client, no secrets in the browser — while keeping the token paste as the
explicit dev/hs256 fallback.

## Work units

1. `ADR-021` and this plan.
2. `auth/pkce.ts`: WebCrypto verifier/challenge (S256) + state generation.
3. `auth/oidc.ts`: explicit config from `VITE_OIDC_*`, authorization URL
   builder, transient attempt storage (verifier+state, single use), code
   exchange (form-encoded, explicit error mapping).
4. `/callback` route: state validation before any network call, exchange,
   then the EXISTING `signIn()` door (API-validated session, ADR-017 rules
   unchanged).
5. Login page: IdP button when configured, token paste fallback always
   available for dev; `apps/dashboard/.env.example`.
6. Tests: Vitest (S256 known-answer test, attempt storage single-use,
   authorization URL parameters, exchange success/error mapping, callback
   state mismatch rejection); Python contract tests
   `tests/project/test_phase11_oidc_pkce.py` (incl. "no client_secret
   anywhere in the dashboard").
7. CHANGELOG.

## Acceptance criteria

- [x] PKCE S256 challenge matches the RFC 7636 appendix B test vector;
      verifier and state are single-use and never leave the tab.
- [x] A callback with a wrong/missing state is rejected before any network
      call (asserted: fetch mock never invoked); token-endpoint errors
      surface as sign-in errors.
- [x] The access token enters through the existing validated `signIn()`
      door; session rules (sessionStorage, 401 = death) unchanged.
- [x] No `client_secret` exists anywhere in the dashboard source
      (contract-tested).
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope

- Silent renewal / refresh tokens, RP-initiated logout, multi-IdP.

## Closure evidence

Local verification passed on branch `phase-11/oidc-pkce` (2026-06-10):

- [x] `npm test` passed: **191** Python contract tests (11 new).
- [x] `npm run test:dashboard` passed: **24** Vitest tests (10 new OIDC/PKCE
      tests incl. the RFC 7636 known-answer vector).
- [x] Dashboard typecheck and build passed (~81 kB gzip).
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification: pending PR.
