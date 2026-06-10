---
project: AURION
document: Phase 7 Admin Dashboard Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-10
related: ADR-009, ADR-013, ADR-016, ADR-017
---

# Phase 7 — Admin dashboard

Phase 7 gives the backend its human half: a tenant-scoped admin/supervisor
panel (`ADR-017`) where the ADR-013 approval workflow finally has a UI —
review requested actions, approve/reject with authority rules mirrored from
the policy, execute approved work, administer users and knowledge, and read
session/audit evidence.

## Work units

1. `ADR-017` and this plan.
2. Workspace scaffold `apps/dashboard`: Vite + React + TS, router, app
   shell, hand-owned stylesheet; CI wiring (typecheck, vitest, build).
3. Session layer: `sessionStorage`-held bearer token, client-side claim
   decode + `exp` check for UX, server validation on sign-in, 401 = session
   death. OIDC PKCE explicitly deferred (ADR-017 seam documented).
4. Typed API client: bearer + Problem Details + `Idempotency-Key` +
   correlation id; resource functions for all six ADR-009 contract groups;
   types mirror `32_API_REFERENCE/openapi.json`.
5. Pages: sign-in; actions (filterable list + approve/reject/execute gated
   by the mirrored authority rules); users (list/invite/role/status);
   knowledge (list/create/lifecycle transitions); voice sessions (list);
   audit events (list); tenant settings (view/edit).
6. Tests: Vitest (session, client, approval gating); Python contract tests
   `tests/project/test_phase7_dashboard.py`; CHANGELOG.

## Acceptance criteria

- [x] `npm run build` in `apps/dashboard` produces a static bundle
      (~80 kB gzip); CI verify runs dashboard typecheck + tests + build.
- [x] Tokens live in `sessionStorage` only; a 401 anywhere drops the
      session; claims are never used as authority (UX gating only) —
      enforced by contract tests on usage patterns.
- [x] Approval UX mirrors ADR-013: requester sees no approve button on
      their own action, machine-requested gated actions demand approval
      before execute is offered, terminal actions offer nothing.
- [x] All pages consume the API exclusively through the typed client
      (no raw fetch in pages, contract-tested); cursor pagination is
      opaque "load more".
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope (later phases)

- OIDC Authorization Code + PKCE against the external IdP.
- Realtime/live views (needs the deferred WebSocket contracts ADR).
- Component render / Playwright E2E suites (with deployment environments).
- Metrics/quality evaluation views (needs the metrics backend).

## Closure evidence

Local verification passed on branch `phase-7/dashboard` (2026-06-10):

- [x] `npm test` passed: **138** Python contract tests (13 new for phase 7).
- [x] `npm run test:api` passed: **126** Jest unit tests (API untouched).
- [x] `npm run test:dashboard` passed: **14** Vitest tests (session layer,
      API client, approval gating).
- [x] `npm --workspace @aurion/dashboard run typecheck` and `build` passed
      (static bundle ~80 kB gzip).
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification passed on head `f03b343` (2026-06-10), PR #20:

- [x] PR opened: `https://github.com/danielheroiaagen/AURION/pull/20`
- [x] All six checks green on the first CI round: verify (now including
      dashboard typecheck + tests + build), integration, dependency-audit,
      secret-scan, CodeQL, analyze (javascript-typescript).

Merge evidence:

- [x] PR #20 squash-merged into `main` as `2277c2a` on 2026-06-10 with all
      checks green.

Carried follow-ups: OIDC PKCE sign-in against the external IdP,
component/E2E test suites with deployment environments, realtime views
behind the WebSocket contracts ADR, metrics views behind the metrics
backend.
