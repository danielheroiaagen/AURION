---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-002, ADR-007, ADR-008, ADR-009, ADR-011
---

# ADR-012 — Runtime persistence implementation

## Decision

Implement the runtime persistence layer decided in `ADR-008` with the following
concrete design, and bind the first tenant-scoped REST resources (`ADR-009`) to
it:

1. **Kysely over node-postgres** with a hand-written typed schema that mirrors
   the SQL migrations. Types follow the database; they never generate it.
2. **Tenant context propagation through short transactions**: every query that
   touches tenant-owned tables runs inside a transaction that first executes
   `SELECT set_config('app.tenant_id', $1, true)` (the parameterized equivalent
   of `SET LOCAL app.tenant_id`). RLS policies from migration `0002` therefore
   apply to every repository call; there is no code path that queries
   tenant-owned tables outside a tenant scope.
3. **A dedicated SQL-first migration runner** (`tools/db/migrate.mjs`) with a
   `schema_migrations` ledger (filename + SHA-256 checksum + timestamp).
   Migrations are applied in lexicographic order and verified by checksum; the
   runner never runs at application startup (ADR-008 rule).
4. **Database-backed authorization audit sink** writing to the append-only
   `audit_events` table, replacing the logging binding of
   `AuthorizationAuditPort` when a database is configured.
5. **Application-side column encryption** (ADR-011): AES-256-GCM with versioned
   keys supplied via environment/secrets manager. Keys never reach the database
   server.

## Configuration contract

| Variable | Required | Meaning |
|----------|----------|---------|
| `DATABASE_URL` | yes | PostgreSQL connection string. The API fails closed at startup without it. |
| `DATABASE_POOL_MAX` | no (default 10) | Upper bound of pooled connections. |
| `DATABASE_SSL` | no (default off) | `require` enables TLS to the database. |
| `DATA_ENCRYPTION_KEYS` | yes | Comma-separated `keyId:base64(32 bytes)` entries; first entry is the active encryption key, the rest are decrypt-only (rotation). |

Fail-closed rule: missing or malformed values abort startup, exactly like
`JWT_SECRET` in Phase 2. There are no insecure defaults.

## Tenant scope design

- `TenantScopedDb.withTenant(tenantId, fn)` is the only door to tenant-owned
  tables. It opens a transaction, sets the transaction-local GUC with a
  parameterized `set_config(...)` call (no SQL string interpolation), runs the
  repository callback, and commits.
- The GUC is transaction-local (`is_local = true`), so pooled connections can
  never leak a tenant context between requests.
- Platform-level (cross-tenant) administration is out of scope for the API: it
  requires the BYPASSRLS role provisioned by infrastructure, not application
  code.

## Audit sink semantics

- `DbAuditSink` inserts authorization evidence into `audit_events` within the
  evidence's tenant scope; the table's RLS policy and append-only trigger
  remain the hard guarantees.
- The port stays synchronous for callers; the insert is dispatched
  asynchronously. A failed insert (or evidence without a tenant, which RLS
  rejects by design) falls back to the structured logging sink so evidence is
  never silently dropped.
- The database sink is the application binding (startup already requires
  `DATABASE_URL`); the logging sink remains its in-process fallback and the
  direct binding for database-less tooling and unit tests.

## Column encryption envelope

- Algorithm: AES-256-GCM (authenticated encryption), 12-byte random IV per
  value, 16-byte tag.
- Wire format: `enc:v1:<keyId>:<iv_b64url>:<ciphertext_b64url>:<tag_b64url>`.
  The prefix makes encrypted values self-describing, the `keyId` enables
  rotation: new writes use the active key, reads accept any configured key.
- First consumers: `voice_sessions.summary` and controlled-action payloads when
  those resources land; the service ships now (with tests) so no plaintext
  sensitive content is ever persisted (ADR-011 trigger point).

## Pagination

List endpoints use **opaque cursor pagination** (`ADR-009`): the cursor encodes
`(created_at, id)` as base64url JSON, ordering is `created_at DESC, id DESC`
(total order, no offset drift). Clients treat cursors as opaque tokens.

## Testing strategy

- **Unit (Jest)**: domain rules, use cases against in-memory repository fakes,
  encryption vectors (roundtrip, tamper, rotation), cursor codec, audit sink
  fallback.
- **Integration (Jest, `test/integration`)**: run only when `DATABASE_URL` is
  present — locally optional, mandatory in CI against a `postgres:16` service.
  They apply the real migrations with the real runner, then prove the security
  contract end to end: RLS isolation between two tenants through the Kysely
  layer, audit append-only enforcement, and repository behavior.
- CI gains an `integration` job; `verify` keeps running without a database.

## Consequences

- The API now requires a reachable PostgreSQL in real deployments;
  `.env.example` documents the full contract.
- Repositories live in `infrastructure/` adapters behind ports, keeping domain
  and use cases database-free (ADR-001, ADR-008).
- Migration `0001`/`0002` become executable evidence in CI instead of reviewed
  text only.
- A follow-up ADR still owes key rotation operations and crypto-shredding for
  GDPR erasure (ADR-011 out-of-scope list).

## Out of scope

- Voice session and controlled action endpoints (next phase; they consume the
  encryption service and idempotency machinery).
- External IdP / RS256 + JWKS.
- pgvector and embedding storage.
- Hosting/provider selection, backups, PITR.
