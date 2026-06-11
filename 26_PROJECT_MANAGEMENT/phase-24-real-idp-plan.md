---
project: AURION
document: Phase 24 Real IdP Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-11
related: ADR-007, ADR-016, ADR-021, ADR-033
---

# Phase 24 — Real IdP: the hs256 exception closes

The last item of Daniel's "haz las 3". ADR-033: self-hosted Keycloak on
the VPS, jwks verification in the API, client_credentials identity for
the gateway, real login for the dashboard.

## Work units

1. Gateway machine identity: `OidcTokenProvider` (client_credentials,
   cached/single-flight/early-refresh), `AurionApiClient` takes a token
   provider, config fail-closed on exactly one identity mechanism.
2. Compose: `keycloak` service (`--profile idp`, /auth path, postgres
   schema in the aurion DB) + gateway `OIDC_*` passthrough + dashboard
   `VITE_OIDC_*` build args (public values baked by Vite).
3. Bootstrap script (kcadm): realm `aurion`, PKCE dashboard client,
   confidential gateway client with hardcoded `actor_type`/`tenant_id`
   mappers, attribute→claim mappers, audience `aurion-api`, admin user.
4. Cutover on the VPS (sequenced for a live line, rollback = AUTH_MODE
   back): create keycloak DB → deploy + bootstrap → verify minted claims
   → flip API to jwks + gateway to OIDC in one restart → rebuild
   dashboard with OIDC envs → verify health, a simulated phone call and
   dashboard login.
5. Contract tests `tests/project/test_phase24_real_idp.py`; CHANGELOG;
   `.env.example`.

## Acceptance criteria

- [x] API verifies RS256 via Keycloak's JWKS with pinned issuer and
      audience; hs256 remains dev/CI-only.
- [x] The gateway holds NO long-lived token: client_credentials with
      automatic refresh; a phone call works end to end in jwks mode.
- [x] Daniel signs into the dashboard with email+password (PKCE); the
      pasted-token fallback stays for dev.
- [x] Rollback documented: pre-flip `.env` snapshot in /root/backups;
      AUTH_MODE=hs256 + the old env restores service in one restart.

## Out of scope

- MFA/passkeys (operator config later), self-registration, per-tenant
  realms, SCIM provisioning.

## Closure evidence

- PR #46 squash-merged into `main` as `1007492` (2026-06-11), all checks
  green; 314 contract tests (8 new), 80 gateway Vitest tests (6 new).
- Cutover executed the same day, sequenced for the live line (operator
  warned first — the no-deploys-while-testing rule): keycloak DB/role in
  the aurion postgres → Keycloak 26.4.7 up behind Traefik at `/auth`
  with TLS in 10 s → realm bootstrapped by the kcadm script → machine
  token claims verified BEFORE the flip (iss/aud/actor_type=voice_agent/
  tenant_id exact) → API+gateway+dashboard flipped in one restart.
- Verification battery, all green: health 200 in jwks mode; the OLD
  hs256 admin token now answers **401** (the exception is really
  closed); a simulated phone call played its greeting through the full
  gateway → IdP (client_credentials RS256) → API chain; the dashboard
  bundle carries the OIDC public client and serves 200.
- Operator credentials rotated to a real login (email + password,
  delivered out-of-repo); Keycloak admin console password likewise.

The ADR-016 production rule is now FACT, not target: every production
token is short-lived RS256 minted by infrastructure we own.
