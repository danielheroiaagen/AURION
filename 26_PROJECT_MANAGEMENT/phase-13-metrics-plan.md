---
project: AURION
document: Phase 13 Metrics & Supervision Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-10
related: ADR-009, ADR-017, ADR-023
---

# Phase 13 — Metrics & supervision

Phase 13 gives supervisors their numbers (`ADR-023`): a tenant-scoped
metrics endpoint computed inside RLS, and a dashboard Overview landing page
with KPI cards, CSS-only bars, auto-refresh, and a pending-approvals
counter. No schema change — the evidence tables already hold everything.

## Work units

1. `ADR-023` and this plan.
2. API `metrics` module (hexagonal): `metrics:read` permission
   (catalog/matrix/docs), repository with SQL aggregates via
   `TenantScopedDb`, `GET /api/v1/metrics/overview?days=N` (default 7,
   max 90); rates computed server-side, `null` on zero denominators;
   OpenAPI artifact regenerated.
3. Dashboard: Overview page as the new index (KPI cards, by-status and
   by-type bars, 30s auto-refresh), pending-approvals badge in the nav.
4. Tests: API unit (service math incl. zero-denominator cases) +
   integration (aggregates against real PostgreSQL with seeded fixtures);
   dashboard Vitest (rate formatting, response mapping); Python contract
   tests `tests/project/test_phase13_metrics.py`.
5. CHANGELOG.

## Acceptance criteria

- [x] `/metrics/overview` is deny-by-default (`metrics:read`), tenant-scoped
      through RLS (cross-tenant fixture proven invisible in integration),
      window-bounded (1–90 days), and returns `null` rates on zero
      denominators — never NaN or fake percentages. Approval rate is counted
      from decision stamps, not current status (executed actions still count
      as approved decisions).
- [x] The dashboard Overview shows sessions/actions KPIs and refreshes
      itself; the nav shows the live pending-approvals count (failing
      silently for roles without `metrics:read`).
- [x] OpenAPI artifact regenerated in the same PR (drift check green).
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope

- Realtime admin event stream (deferred to the media-server phase),
  CSAT/latency percentiles, exports, per-user breakdowns.

## Closure evidence

Local verification passed on branch `phase-13/metrics-dashboard`
(2026-06-10):

- [x] `npm test` passed: **213** Python contract tests (13 new).
- [x] `npm run test:api` passed: **129** Jest unit tests (2 new rate-math
      tests incl. zero denominators and decision-stamp counting).
- [x] `npm run test:api:integration` passed against `postgres:16`: **23**
      tests (2 new: seeded aggregates with cross-tenant isolation, window
      bounds vs. live pending counter).
- [x] `npm run test:dashboard` passed: **28** Vitest tests (4 new).
- [x] OpenAPI regenerated (`/api/v1/metrics/overview` present); dashboard
      build green; `npm audit`: 0 vulnerabilities.

Remote verification: pending PR.
