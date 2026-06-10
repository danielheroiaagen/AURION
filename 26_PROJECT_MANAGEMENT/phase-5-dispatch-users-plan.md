---
project: AURION
document: Phase 5 Action Dispatch & Users Administration Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-10
related: ADR-003, ADR-009, ADR-011, ADR-013, ADR-014, ADR-015
---

# Phase 5 — Action dispatch & users administration

Phase 5 closes the two gaps that separate the phase-4 backend from a
shippable API core: controlled actions now **really dispatch** through an
executor port instead of trusting client-supplied results (`ADR-014`), and
the last ADR-009 contract group without a REST surface — users and
memberships — gets its tenant-scoped endpoints. The phase also lands the
key-rotation and crypto-shredding decision deferred since ADR-011
(`ADR-015` + `05_SECURITY/key-rotation-runbook.md`).

## Work units

1. `ADR-014`, `ADR-015`, key-rotation runbook, and this plan.
2. Dispatch layer (`ADR-014`):
   - `dispatch.config.ts`: `ACTION_DISPATCH_MODE` (`noop` default, `hermes`
     fail-closed on missing/weak `HERMES_DISPATCH_URL`/`HERMES_DISPATCH_SECRET`).
   - `ActionDispatcherPort` + `HermesHttpDispatcher` (HMAC-SHA256 signed
     requests, timeout via AbortController, failures returned not thrown) +
     `NoopDispatcher` (honest `dispatch_mode: "noop"` stamp).
   - `ControlledActionsService.execute` dispatches after authorization;
     `ok` → `executed` with the dispatcher's payload, failure → `failed`
     with error evidence persisted **before** surfacing 502.
   - `ExecuteActionDto` loses `result_payload` (breaking, recorded in ADR-014).
3. Users & memberships REST (`ADR-009` group):
   - Permissions `user:read`, `user:manage` (catalog, matrix,
     `05_SECURITY/permissions.md`).
   - `users` module (hexagonal): invite (global user upsert + tenant
     membership in one tenant-scoped transaction), list (membership join,
     cursor pagination), read, membership role/status update.
   - Guard rails: actors never modify their own membership;
     `platform_owner` is not assignable through the API; `users` (global,
     no RLS) is only ever reached through the RLS-protected
     `tenant_memberships` join.
4. Tests: Jest unit suites (dispatchers, execute-with-dispatch, users
   service rules); integration suite `test/integration/users-dispatch.spec.ts`
   (real PostgreSQL: invite → list → role change → disable, email-conflict
   mapping, RLS isolation, executed action persists noop evidence encrypted);
   Python contract tests `tests/project/test_phase5_dispatch_users.py`.
5. Docs and wiring: `.env.example`, CHANGELOG, root `package.json` test
   commands, `app.module.ts`.

## Acceptance criteria

- [x] `POST /api/v1/actions/:id/execute` takes no result payload; the
      persisted `result_payload` provably originates from the dispatcher
      (noop stamp in tests), and dispatch failure persists `failed` +
      error evidence and returns 502.
- [x] `hermes` mode refuses to start without URL + strong secret; requests
      are HMAC-signed (timestamp-bound) and time out cleanly.
- [x] Users endpoints are tenant-scoped, deny-by-default, cursor-paginated;
      self-membership mutation and `platform_owner` assignment are rejected.
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope (later phases)

- Asynchronous dispatch (HERMES callbacks/webhooks), outbox delivery,
  circuit breakers.
- Re-encryption sweep tooling (scheduled with the first real rotation,
  ADR-015).
- Per-tenant derived keys / per-tenant crypto-shredding.
- External IdP (RS256 + JWKS); generated OpenAPI artifact.

## Closure evidence

Local verification passed on branch `phase-5/dispatch-users` (2026-06-10):

- [x] `npm test` passed: **110** Python contract tests (20 new for phase 5).
- [x] `npm run test:api` passed: **113** Jest unit tests (11 suites).
- [x] `npm run test:api:integration` passed against a disposable
      `postgres:16` container: **21** integration tests (3 suites), including
      invite → list → role change → disable through the RLS-protected
      membership join, cross-tenant identity reuse without mutation, failed
      dispatch persisting encrypted error evidence, and the noop dispatch
      stamp on executed actions.
- [x] `npm --workspace @aurion/api run typecheck` and `build` passed.
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification passed on head `8c00bee` (2026-06-10), PR #18:

- [x] PR opened: `https://github.com/danielheroiaagen/AURION/pull/18`
- [x] All six checks green: verify, integration (postgres:16 service),
      dependency-audit, secret-scan, CodeQL, analyze (javascript-typescript).
- [x] First CI round caught a fixture collision (`tenants_slug_key` across
      suites) fixed in `8c00bee` with suite-unique slugs — the integration
      job is doing its job.

Merge evidence:

- [x] PR #18 squash-merged into `main` as `33ef730` on 2026-06-10 with all
      six checks green.

Carried follow-ups: external IdP (RS256 + JWKS), generated OpenAPI artifact,
re-encryption sweep tooling at first rotation (ADR-015), per-tenant derived
keys ADR when a compliance-bound customer requires provable erasure, HERMES
receiver-side contract (staleness window + action_id dedupe), and adding
`integration` to the required status checks on `main`.
