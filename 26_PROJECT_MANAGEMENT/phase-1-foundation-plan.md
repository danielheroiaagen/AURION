---
project: AURION
document: Phase 1 Foundation Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: ready-for-remote-closure
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
- [x] Phase 1 hardening review completed locally.
- [x] Tenant-safe user attribution constraints added to MVP schema.
- [x] Production-safe Swagger exposure added.
- [x] Global request validation baseline added.
- [x] npm 11 CI consistency added.

## CI gates

The GitHub Actions workflow at `.github/workflows/ci.yml` runs:

1. `npm install -g npm@11`
2. `npm --version`
3. `npm ci`
4. `npm test`
5. `npm --workspace @aurion/api run typecheck`
6. `npm --workspace @aurion/api run build`

Branch protection should require the `verify` job after this workflow is merged or active on `main`.

## Closure evidence

Phase 1 local verification passed on branch `phase-1/nestjs-foundation` at commit `56a647d chore: harden phase 1 foundation safeguards`:

- [x] `npm ci` completed with 0 vulnerabilities.
- [x] `npm test` passed: 28 tests.
- [x] `npm --workspace @aurion/api run typecheck` passed.
- [x] `npm --workspace @aurion/api run build` passed.
- [x] Fresh hardening review returned PASS.

Remote GitHub CI and PR #7 cannot be confirmed from the current local environment because the private repository returns `404` without authenticated GitHub access and `gh` is not installed locally. Final closure requires confirming the remote `verify` job on PR #7.

## Repository protection status

Attempted to enable basic `main` branch protection on 2026-06-01.

GitHub returned:

```txt
Upgrade to GitHub Pro or make this repository public to enable this feature.
```

Decision: keep the repository private for now and enforce review discipline through PR workflow until branch protection is available. Revisit after upgrading GitHub plan or deciding to make the repository public.

## Next step

Confirm PR #7 remote CI on GitHub, then merge or formally approve Phase 1 closure.

## Phase 1 hardening follow-up

These risks remain intentionally out of this focused work unit to avoid large dependency churn before endpoint implementation:

- Add rate limiting once public auth boundaries and endpoint shapes are implemented.
- Add security headers middleware after confirming the deployment proxy/header strategy.
- Define JSONB redaction rules before storing sensitive request or tool payloads beyond MVP placeholders.
