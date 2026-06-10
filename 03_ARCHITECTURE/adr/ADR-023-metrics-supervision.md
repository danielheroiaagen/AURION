---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-007, ADR-009, ADR-013, ADR-017
---

# ADR-023 — Metrics and supervision surface

## Decision

AURION exposes a tenant-scoped **metrics overview endpoint**,
`GET /api/v1/metrics/overview?days=N`, computed with SQL aggregates inside
the tenant scope (RLS applies — a metrics query can never see another
tenant's rows by construction), guarded by a new `metrics:read` permission
(tenant_admin, supervisor, auditor, platform_owner).

The dashboard gains an **Overview page** as its landing view: KPI cards and
CSS-only bars (the no-chart-library rule of ADR-017 holds) with periodic
auto-refresh, plus a pending-approvals counter in the navigation — the
supervisor's "is anything waiting on me?" signal.

## Context

The PRD lists supervision KPIs (autonomous resolution, escalation, action
success) and phase 7 shipped the operational dashboard without them. All the
raw data already exists in `voice_sessions`, `controlled_actions` and
`audit_events`; this phase derives the numbers — no schema change.

**Realtime admin push (WebSocket events for the dashboard) stays deferred**:
polling at a 30s interval is honest, cheap, and sufficient at MVP call
volumes; an admin event stream is a new contract surface (the ADR-009
deferral) that should arrive with the media-server phase where realtime
infrastructure gets built anyway.

## Metrics contract (window = last N days, default 7, max 90)

- `sessions`: total, by status, completion rate (completed / closed).
- `actions`: total, by status, by type, approval rate
  (approved / decided), execution success rate (executed / (executed+failed)).
- `approvals_pending`: current count of `requested` actions — the live
  workload signal, independent of the window.

Derived rates are computed in the API (one definition for every consumer),
returned as numbers in `[0, 1]`, `null` when the denominator is zero —
never `NaN`, never a fake 0% / 100%.

## Consequences

- New permission `metrics:read` in catalog/matrix/docs; the OpenAPI artifact
  is regenerated in the same change (CI drift check enforces it).
- Aggregates run per request; at MVP volume this is fine. When tenants grow,
  the seam for materialized rollups is the repository adapter — the contract
  does not change.
- Out of scope: per-agent/per-user breakdowns, CSAT/NPS (needs survey
  capture), latency percentiles (needs turn-level timing capture in the
  gateway), exports, and the realtime admin event stream.
