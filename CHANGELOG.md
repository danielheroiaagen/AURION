# Changelog

All notable changes to AURION will be documented here.

The format follows Keep a Changelog principles and commit messages follow Conventional Commits.

## [Unreleased]

### Added

- Professional repository governance files for Git/GitHub readiness.
- Phase 0 GitHub readiness plan.
- ADR for the initial Voice Agent SaaS Core MVP.
- ADR for Git/GitHub governance.
- Local GitHub repository creation tool.
- Private GitHub repository `danielheroiaagen/AURION`.
- Phase 0 GitHub decision issues for implementation blockers.
- Phase 1 NestJS + TypeScript backend decision and initial monorepo scaffold.
- GitHub Actions CI workflow for tests, API typecheck, and API build.
- ADR-007 for JWT, tenant-scoped RBAC, Policy Guard, and sensitive action authorization.
- ADR-008 for PostgreSQL-first migrations and the Kysely/node-postgres query layer strategy.
- ADR-009 for OpenAPI-first REST MVP API contracts.
- Executable PostgreSQL MVP core schema migration with reversible `up/down` files.
- Phase 1 hardening safeguards: tenant-safe user attribution constraints, production-safe Swagger exposure, global request validation, npm 11 CI consistency, and explicit PostgreSQL 15+ migration target.
- Phase 1 closed through PR #7 after remote PR CI and `main` push CI passed.
- Phase 2 (PR #8): JWT auth, tenant-scoped RBAC with deny-by-default Policy
  Guard, database RLS + append-only audit, HTTP edge hardening, and CI
  security scanning (ADR-010, ADR-011).
- ADR-012 runtime persistence implementation: Kysely over node-postgres,
  transaction-local tenant context (`set_config('app.tenant_id', ...)`),
  checksummed SQL migration runner (`npm run db:migrate` / `db:status`),
  database-backed authorization audit sink, and AES-256-GCM column encryption
  with versioned, rotation-ready keys.
- First tenant-scoped REST resources (ADR-009): tenant administration,
  knowledge documents with an explicit lifecycle (draft → review → published
  → archived), and audit evidence reads with opaque cursor pagination.
- `tenant:read` and `knowledge:read` permissions in the catalog and matrix.
- Integration test suite against real PostgreSQL (RLS isolation, append-only
  audit, lifecycle compare-and-set) plus a CI `integration` job with a
  `postgres:16` service.
