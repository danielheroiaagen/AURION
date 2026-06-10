---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-003, ADR-008, ADR-014, ADR-018, ADR-019
---

# ADR-020 — Containerized deployment and the end-to-end loop

## Decision

AURION ships as **one Docker Compose stack**: PostgreSQL 16, a one-shot
migration runner, the API, the voice gateway, the HERMES receiver, the
dashboard (static nginx), and a Caddy edge that gives everything one origin
(`/` → dashboard, `/api` → API, `/ws` → gateway). Images are multi-stage
`node:22-alpine` builds, run as the non-root `node` user, and contain only
production dependencies.

The same compose file is the **end-to-end harness**: `npm run e2e` builds
the stack, seeds a tenant, and drives the full product loop with real
processes — WebSocket conversation → voice_agent action request → human
approval over REST → execution through the REAL HMAC-signed dispatch into
the HERMES receiver → encrypted evidence verified back through the API.
CI runs it on every PR (`e2e` job).

## Context

Phases 0–9 produced four runnable services proven by unit/integration
suites, but never *together*. ADR-003 places AURION on a Hostinger VPS;
compose is the right size for a single-VPS MVP (no orchestration platform
to operate), while images keep us portable when something bigger is needed.
The deferred gateway↔API E2E suite (phase 8) lands here, where real
environments exist.

## Key choices

- **Migrations run as a one-shot service** (`tools/db/migrate.mjs`), never
  at app startup (ADR-008/ADR-012 rule); the API waits for its successful
  completion via compose dependencies.
- **One origin via Caddy** — the dashboard keeps same-origin `/api` calls
  (no CORS in production), TLS termination and the real domain live at this
  edge (runbook).
- **`HERMES_DISPATCH_ALLOW_INSECURE_HTTP`** — inside the compose network the
  API dispatches to `http://hermes-receiver:8090`; plain http to non-local
  hosts requires this explicit flag, is documented as private-network-only,
  and production-over-public-networks remains https-only fail-closed.
- **Secrets enter only via environment** (compose `${VAR}` interpolation
  from an uncommitted `.env`); the repo carries no credentials. The E2E
  driver mints its own throwaway HS256 tokens at run time — no token ever
  lands in git (keeps secret-scan meaningful).
- **E2E asserts outcomes through the API**, not through internals: the
  action ends `executed` with `connector_mode: "stub"` evidence (decrypted
  for an authorized reader) and the voice session ends `completed` with a
  summary — exactly what a customer audit would check.

## Consequences

- `10_DEPLOYMENT/vps-deploy-runbook.md` documents the Hostinger VPS
  procedure: engine install, `.env` contract, `--profile full` bring-up,
  TLS via Caddy, `pg_dump` backups, and the update path.
- The `e2e` CI job is informative-first (not yet a required check) until
  its runtime proves stable; promoting it mirrors how `integration` was
  promoted.
- Out of scope: multi-node orchestration, zero-downtime deploys, managed
  database migration, media server (WebRTC/SIP) — each gets its own
  decision when scale demands it.
