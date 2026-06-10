---
project: AURION
document: Phase 3 Persistence & First Resources Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in_progress
created_at: 2026-06-10
related: ADR-008, ADR-009, ADR-011, ADR-012
---

# Phase 3 — Persistence layer & first tenant-scoped resources

Phase 3 turns the database design into running code. It implements the Kysely +
node-postgres layer (`ADR-008`/`ADR-012`), makes the SQL migrations executable
through a checksummed runner, replaces the logging audit sink with the
database-backed adapter, ships the column-encryption service committed in
`ADR-011`, and exposes the first tenant-scoped REST resources from `ADR-009`:
tenant administration, knowledge documents, and audit evidence reads.

## Why this scope

Endpoints without persistence would be throwaway stubs; persistence without a
consumer would be unproven plumbing. A vertical slice — infrastructure plus the
three least-coupled contract groups — exercises RLS, auditing, pagination, and
authorization end to end, and leaves voice sessions / controlled actions (the
groups that need idempotency machinery and encryption consumers) for Phase 4 on
proven foundations.

## Work units

1. `ADR-012` and this plan.
2. Migration runner `tools/db/migrate.mjs` (`db:migrate`, `db:status`) with a
   `schema_migrations` checksum ledger. No runtime auto-migrate.
3. Database infrastructure in `apps/api`: fail-closed `database.config.ts`,
   global `DatabaseModule` (pool lifecycle, graceful shutdown), typed Kysely
   schema mirroring migrations `0001`/`0002`, and `TenantScopedDb` — the only
   gateway to tenant-owned tables, which sets the transaction-local
   `app.tenant_id` GUC via parameterized `set_config`.
4. `FieldEncryptionService` (AES-256-GCM, versioned keys, rotation-ready
   envelope) per `ADR-011`/`ADR-012`.
5. `DbAuditSink` writing authorization evidence to append-only `audit_events`,
   with logging fallback; binding selected by configuration.
6. Resource modules (hexagonal: domain / application ports + use cases /
   infrastructure Kysely repositories / HTTP controllers + DTOs + OpenAPI):
   - `tenants`: read own tenant, update settings (`tenant:read`,
     `tenant:settings:update`).
   - `knowledge-documents`: create, read, cursor-paginated list, lifecycle
     status transitions draft → review → published → archived
     (`knowledge:read`, `knowledge:write`).
   - `audit-events`: cursor-paginated read (`audit:read`).
   - Permission catalog gains `tenant:read` and `knowledge:read`; matrix and
     `05_SECURITY/permissions.md` updated.
7. Tests:
   - Jest unit suites for crypto, cursor codec, use cases, policy matrix
     additions, audit sink fallback.
   - Jest integration suite (`test/integration`), skipped without
     `DATABASE_URL`, mandatory in CI: applies real migrations via the runner,
     proves RLS tenant isolation, audit append-only, and repository contracts.
   - Python contract tests `tests/project/test_phase3_persistence.py`.
8. CI: `integration` job with a `postgres:16` service container (SHA-pinned
   actions, least-privilege permissions), wired as a required check after
   merge.
9. Docs: `.env.example`, `database/README.md` (runner usage), `CHANGELOG.md`.

## Acceptance criteria

- [x] Migrations apply (and re-apply idempotently: already-applied files are
      skipped, checksum drift fails loudly) through `npm run db:migrate`.
- [x] Every repository access to tenant-owned tables goes through
      `TenantScopedDb.withTenant`; no query path bypasses the GUC.
- [x] Integration tests prove cross-tenant reads return zero rows and
      cross-tenant writes fail under RLS, through the real API query layer.
- [x] Authorization evidence for sensitive decisions lands in `audit_events`;
      update/delete attempts on that table fail (append-only trigger).
- [x] `FieldEncryptionService` round-trips, rejects tampered ciphertext,
      and decrypts with retired keys (rotation).
- [x] Tenants / knowledge-documents / audit-events endpoints are tenant-scoped,
      deny-by-default, cursor-paginated where lists exist, and return Problem
      Details errors with correlation ids.
- [x] `npm test`, `npm run test:api`, typecheck, and build pass locally;
      integration suite passes in CI with 0 vulnerabilities in `npm audit`
      (local pass evidenced below; CI parity pending push).

## Out of scope (Phase 4+)

- `voice-sessions` and `actions` endpoints (idempotency-key machinery,
  encryption consumers, approval workflow).
- Key rotation operations / crypto-shredding ADR.
- External IdP (RS256 + JWKS), pgvector, hosting decisions.

## Closure evidence

Local verification passed on branch `phase-3/persistence-and-resources`
(2026-06-10):

- [x] `npm install` completed with **0 vulnerabilities** (629 packages).
- [x] `npm test` passed: **75** Python contract tests (24 new for phase 3).
- [x] `npm run test:api` passed: **63** Jest unit tests (7 suites).
- [x] `npm run test:api:integration` passed against a disposable
      `postgres:16` container: **10** integration tests proving migration
      runner idempotency, RLS tenant isolation through a NOBYPASSRLS role,
      append-only audit enforcement, lifecycle compare-and-set, integrity
      error mapping, and cursor pagination.
- [x] `npm --workspace @aurion/api run typecheck` and `build` passed.
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- [x] Runtime smoke test: `/api/v1/health` 200; protected routes 401 without a
      token; startup fails closed without `DATA_ENCRYPTION_KEYS` and without
      `DATABASE_URL`.

Remote verification: to be completed at phase close (PR + CI runs).
