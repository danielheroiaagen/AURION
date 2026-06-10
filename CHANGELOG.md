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
- ADR-013 voice sessions & controlled actions: lifecycles with compare-and-set
  transitions, required `Idempotency-Key` with same-payload replay semantics,
  and the request → approve/reject → execute human-approval workflow
  (self-approval banned, machine approvers banned, execution re-authorized
  through the policy with the database-recorded approval).
- `/api/v1/voice-sessions` and `/api/v1/actions` endpoints, completing all six
  ADR-009 MVP contract groups; `conversation:write` and `action:read`
  permissions.
- First real consumers of column encryption: `voice_sessions.summary` and
  controlled-action payloads are AES-256-GCM ciphertext at rest (verified by
  raw-column reads in integration tests).
- ADR-014 action dispatch port: `POST /actions/:id/execute` now dispatches
  through `ActionDispatcherPort` (HMAC-signed `HermesHttpDispatcher` or the
  honest `NoopDispatcher`); execution evidence comes from the dispatcher,
  dispatch failures persist `failed` + error evidence before surfacing 502.
- `/api/v1/users` and `/api/v1/memberships` endpoints (last ADR-009 group):
  tenant-scoped invites through the RLS-protected membership join, role/status
  administration with self-modification and `platform_owner` assignment
  banned; `user:read` and `user:manage` permissions.
- ADR-015 + `05_SECURITY/key-rotation-runbook.md`: encryption key rotation
  (prepend, sweep, verified retirement, escrow for backups) and the
  crypto-shredding posture.

- ADR-016 external IdP support: `AUTH_MODE=jwks` verifies RS256 tokens
  against the IdP's JWKS endpoint (kid-cached, cooldown-limited rotation
  refresh, algorithm pinned, issuer+audience mandatory) with `node:crypto`
  only — no JWT library in the supply chain. HS256 stays the dev/test mode.
- Generated OpenAPI artifact `32_API_REFERENCE/openapi.json` (ADR-009's
  review artifact) via `npm run openapi:generate`; CI fails on drift between
  the committed artifact and the code.
- HERMES dispatch receiver contract
  (`29_HERMES_AGENT_WORKFORCE/dispatch-receiver-contract.md`):
  signature-before-parse, staleness window, `action_id` dedupe.

### Changed

- **Breaking**: `POST /api/v1/actions/:id/execute` no longer accepts a client
  `result_payload` (ADR-014) — execution evidence can only originate at the
  dispatcher boundary.
- `integration` added to the required status checks on `main`.
