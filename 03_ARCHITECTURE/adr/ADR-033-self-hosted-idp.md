---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-007, ADR-016, ADR-021
---

# ADR-033 — Self-hosted Keycloak closes the hs256 exception

## Decision

Production authentication moves to **AUTH_MODE=jwks against a
self-hosted Keycloak** on the same VPS — closing the "honest exception"
recorded at go-live (phase 19) without creating accounts at any external
identity vendor.

- **Keycloak as a compose service** (`--profile idp`, quay.io image,
  `/auth` relative path behind the existing edge, schema in the aurion
  postgres under its own database/role). RAM measured first: 24 GB free
  on the box.
- **Realm `aurion`, two clients, one claim contract** (ADR-007 — the
  claim semantics never changed, only the signature scheme):
  - `aurion-dashboard`: PUBLIC client, Authorization Code + PKCE
    (exactly what the phase 11 dashboard flow expects), redirect
    `<PUBLIC_URL>/callback`. User attributes `tenant_id`/`aurion_role`
    map to the `tenant_id`/`role` claims; `actor_type=user` hardcoded;
    audience `aurion-api`.
  - `aurion-voice-gateway`: CONFIDENTIAL client, client_credentials.
    Hardcoded mappers pin `actor_type=voice_agent` and the tenant id —
    the machine cannot claim to be anything else.
- **The gateway mints its own identity now**: `OidcTokenProvider`
  (client_credentials, cached, single-flight, early refresh) replaces
  the static 365-day JWT; `AurionApiClient` takes a token PROVIDER.
  Config fail-closed: exactly one of `VOICE_AGENT_TOKEN` (hs256 dev) or
  `OIDC_TOKEN_URL`+client credentials.
- **Bootstrap is a script, not clicks**:
  `10_DEPLOYMENT/keycloak-bootstrap.sh` (kcadm) creates realm, clients,
  mappers and the admin user — reproducible, reviewable, in the repo.

## Context

ADR-016 ruled production MUST verify RS256 via JWKS against an external
IdP; the go-live shipped hs256 with a strong secret as a documented
exception. Daniel's "haz las 3" included closing it. Self-hosting keeps
the no-external-accounts property of this whole deployment and the
ADR-017 spirit: own your critical path.

## Consequences

- hs256 stays ONLY as the dev/CI mode (the e2e harness keeps minting its
  throwaway tokens); production tokens are short-lived RS256, machine
  tokens rotate automatically every ~5 minutes.
- Dashboard sign-in becomes a real login (email + password at Keycloak)
  instead of a pasted token; the paste path remains as the dev fallback.
- One more always-on container (~600 MB) on a 31 GB box.
- Out of scope: MFA/passkeys (Keycloak supports them — operator
  configuration), user self-registration, per-tenant realms, SCIM.
