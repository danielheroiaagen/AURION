---
project: AURION
document: Phase 1 Foundation Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: active
created_at: 2026-06-01
---

# Phase 1 — Technical Foundation

Phase 1 establishes the monorepo, backend framework, testing baseline, and CI-ready structure for the Voice Agent SaaS Core MVP.

## Decision

Backend foundation: **NestJS + TypeScript**.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No for foundation docs/scaffold; reassess before auth/DB work |
| Suggested split | Foundation scaffold → auth/RBAC → DB schema → CI |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Work units

1. Backend framework ADR and GitHub issue #1 closure.
2. Monorepo foundation with root workspace and `apps/api`.
3. Testing baseline for project structure.
4. CI and branch protection once app dependencies install cleanly.

## Acceptance criteria

- [x] NestJS + TypeScript decision recorded.
- [x] Root workspace manifest exists.
- [x] API workspace manifest declares NestJS dependencies.
- [x] API source has a minimal health module.
- [x] Project structure tests pass.
- [x] Node dependencies installed and locked.
- [x] API build/typecheck commands pass.
- [x] CI workflow added.

## CI gates

The GitHub Actions workflow at `.github/workflows/ci.yml` runs:

1. `npm ci`
2. `npm test`
3. `npm --workspace @aurion/api run typecheck`
4. `npm --workspace @aurion/api run build`

Branch protection should require the `verify` job after this workflow is merged or active on `main`.

## Repository protection status

Attempted to enable basic `main` branch protection on 2026-06-01.

GitHub returned:

```txt
Upgrade to GitHub Pro or make this repository public to enable this feature.
```

Decision: keep the repository private for now and enforce review discipline through PR workflow until branch protection is available. Revisit after upgrading GitHub plan or deciding to make the repository public.

## Next step

Install dependencies and turn the placeholder NestJS scaffold into a fully buildable API workspace.
