---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-12
related: ADR-007, ADR-027, ADR-033
---

# ADR-035 — Multi-tenant telephony: one gateway, many clients

## Decision

A single voice gateway serves multiple client tenants, each with its own
phone number — WITHOUT touching the tenant-isolation model. The isolation
is the same one proven since phase 2: the tenant comes from the actor's
token and RLS does the rest. Here each call simply uses the RIGHT actor.

- **`TELEPHONY_TENANT_ROUTES`** (JSON array, fail-closed parse): each
  route binds `{ phone, clientKey, greeting, lang, oidcClientId,
  oidcClientSecret }`. Empty = single-tenant (today's behavior, 100%
  backward compatible).
- **The client key identifies the tenant.** Each route gets a UNIQUE
  client key. The `/twiml` door resolves the dialed number (`To`) → that
  tenant's key and emits it in the TwiML `<Parameter>`. The bridge, on
  the WS `start`, looks the key up in the route map and serves that
  tenant's API client, greeting and language. An unrouted number keeps
  the default key — routes are ADDITIVE, the existing number never
  breaks.
- **Per-tenant machine identity.** Each route has its own Keycloak
  client_credentials client whose minted token carries THAT tenant's
  `tenant_id` (hardcoded mapper, ADR-033). The gateway holds one
  `OidcTokenProvider` + `AurionApiClient` per route. A call's actions,
  sessions and knowledge therefore land in the caller's tenant, enforced
  by RLS — a misrouted call cannot read another tenant's data because the
  token simply does not authorize it.

## Context

The business model is call-forwarding (the client forwards their number
to AURION). For the SECOND client to get THEIR sessions/actions/knowledge
instead of Daniel's, the gateway must act as the right voice_agent per
number. The API, RLS and security model already support many tenants
since phase 2-3; the only gap was the telephony routing layer. This adds
exactly that — no API change, no schema migration, no new trust grant.

## Consequences

- Onboarding a client = one Keycloak client + one route entry (env). No
  deploy of code, just config. A self-service provisioning flow is a
  future nicety, not a blocker.
- Secrets per tenant live in the gateway env (the route's
  `oidcClientSecret`). At small scale this is fine; a secrets manager is
  the scale-up path.
- Validation against a REAL second tenant (true cross-tenant isolation
  under load) is pending a real second client — the code and unit tests
  are ready; production rollout flips on with the first onboarding.
- Out of scope: per-tenant STT/TTS/brain (shared providers), self-service
  tenant signup, per-tenant phone purchasing automation.
