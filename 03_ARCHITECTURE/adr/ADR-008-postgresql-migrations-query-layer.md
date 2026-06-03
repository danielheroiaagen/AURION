---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-01
github_issue: https://github.com/danielheroiaagen/AURION/issues/3
---

# ADR-008 — PostgreSQL migrations and query layer

## Decision

**PostgreSQL is the source of truth** for AURION data.

AURION will use **SQL-first migrations** stored in Git and a thin TypeScript query layer using **Kysely** over **node-postgres** when runtime database access is introduced.

That means: no black-box ORM owns the schema. The database design is reviewed explicitly, versioned, and tested.

## Why this matters

The MVP needs multi-tenant isolation, audit trails, realtime conversation evidence, controlled tool execution, and future pgvector support. Those are database and architecture concerns, not just “model classes”.

If we let an ORM auto-shape production tables, we risk hiding tenant boundaries, indexes, constraints, and audit requirements. That is not acceptable for AURION.

## Chosen strategy

| Area | Decision |
|------|----------|
| Database | PostgreSQL remains the primary database. |
| Schema changes | Migrations are explicit files under `database/migrations`. |
| Migration style | SQL-first migrations with clear `up/down` intent. |
| Runtime access | Kysely as a typed SQL query builder. |
| Driver | node-postgres (`pg`) for PostgreSQL connections and pooling. |
| ORM scope | No full ORM as architectural owner during MVP foundation. |
| Escape hatch | Raw SQL is allowed for performance, constraints, indexes, locks, JSONB, pgvector, and complex reports. |

## Rules

- Every customer-owned table must include `tenant_id` unless an ADR explicitly exempts it.
- Migrations must be committed, reviewed, and run through CI before production.
- No auto-sync, auto-migrate, or schema push in runtime application startup.
- Repository implementations may use Kysely, but domain and use cases must depend on ports/interfaces.
- Generated or inferred types must follow the database, not replace database review.
- Sensitive tables need audit-friendly metadata such as actor, timestamps, source, and correlation IDs where relevant.

## Why Kysely instead of a full ORM

Kysely is a type-safe SQL query builder, not a heavy ORM. Its official documentation describes it as a thin SQL abstraction with PostgreSQL dialect support and optional migration primitives.

That fits AURION because we keep SQL visible while gaining TypeScript autocomplete, compile-time help, and safer query construction.

## Consequences

- Issue #3 can be closed after this ADR and backend docs are updated.
- Future DB implementation should add `database/migrations` and migration runner scripts before the first real schema.
- Repositories stay inside infrastructure adapters.
- Domain models remain clean and framework/database independent.
- PostgreSQL-specific features are allowed when they serve correctness, tenant isolation, auditability, or performance.

## Out of scope

- Creating the first production schema.
- Installing Kysely or `pg`.
- Choosing hosting/provider for PostgreSQL.
- Defining backup, PITR, and retention policy.

Those are follow-up implementation decisions.
