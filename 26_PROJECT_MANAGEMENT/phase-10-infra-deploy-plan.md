---
project: AURION
document: Phase 10 Infrastructure & Deployment Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-10
related: ADR-008, ADR-014, ADR-018, ADR-019, ADR-020
---

# Phase 10 — Infrastructure & deployment

Phase 10 makes the four services run **together** (`ADR-020`): multi-stage
images, one compose stack with a single-origin Caddy edge, the VPS
deployment runbook, and — the payoff — an end-to-end suite that drives the
real product loop across real processes on every PR.

## Work units

1. `ADR-020` and this plan.
2. `docker/`: multi-stage Dockerfiles (api incl. migration tooling,
   voice-gateway, hermes-receiver, dashboard+nginx), nginx SPA config,
   Caddyfile, `.dockerignore`.
3. `docker-compose.yml`: postgres (healthcheck, volume), one-shot `migrate`,
   api (waits for migrate), hermes-receiver, voice-gateway, and a `full`
   profile adding dashboard + Caddy edge. Secrets only via `${VAR}`.
4. API config: `HERMES_DISPATCH_ALLOW_INSECURE_HTTP` flag for
   private-network dispatch (compose service DNS), https still mandatory
   otherwise.
5. E2E: `tests/e2e/run-e2e.mjs` (compose up --build → seed tenant/users →
   mint throwaway HS256 tokens → WS conversation → action requested →
   approve (REST, human) → execute (real HMAC dispatch into the receiver)
   → assert `executed` + `connector_mode: "stub"` evidence + session
   `completed` with summary → compose down). `npm run e2e`; CI `e2e` job.
6. `10_DEPLOYMENT/vps-deploy-runbook.md`; Python contract tests
   `tests/project/test_phase10_infra.py`; CHANGELOG.

## Acceptance criteria

- [x] `npm run e2e` passes locally and in CI: the full loop (conversation →
      approval-gated action → human approval → real signed dispatch → stub
      evidence → encrypted-at-rest verification) succeeds across containers
      — including the negative check that pre-approval execution is a 409.
- [x] Images are multi-stage, non-root, production-deps-only; migrations
      run as a one-shot service, never at app startup.
- [x] No secret or token is committed; compose takes everything from the
      environment (the E2E driver mints throwaway secrets at run time);
      plain-http dispatch requires the explicit private-network flag.
- [x] The VPS runbook covers bring-up, TLS, backups, and updates.
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope (later phases)

- Multi-node orchestration, zero-downtime deploys, media server (WebRTC/SIP).
- Promoting `e2e` to a required check (after runtime stability is proven).

## Closure evidence

Local verification passed on branch `phase-10/infra-deploy` (2026-06-10):

- [x] `npm run e2e` **PASSED on the first full run**: stack built from
      scratch, tenant seeded, the conversation → approval → signed dispatch
      → stub evidence → completed-session-with-summary loop verified across
      real containers, stack torn down clean.
- [x] `npm test` passed: **180** Python contract tests (16 new for phase 10).
- [x] `npm run test:api` passed: **127** Jest unit tests (new
      private-network dispatch flag case).
- [x] API typecheck passed; `npm audit`: 0 vulnerabilities.

Remote verification: pending PR.
