---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-01
github_issue: https://github.com/danielheroiaagen/AURION/issues/4
---

# ADR-009 — MVP API contracts

## Decision

AURION will use **OpenAPI-first REST contracts** for the MVP backend.

The first API surface is intentionally small, tenant-scoped, and built around the Voice Agent SaaS Core: tenants, users, knowledge documents, voice sessions, controlled actions, and audit evidence.

## MVP contract groups

| Group | Base path | Purpose |
|-------|-----------|---------|
| Tenant administration | `/api/v1/tenants` | Configure customer company context and settings. |
| Users and memberships | `/api/v1/users`, `/api/v1/memberships` | Manage tenant-scoped users, roles, and access. |
| Knowledge base | `/api/v1/knowledge-documents` | Upload, review, and publish knowledge used by the agent. |
| Voice sessions | `/api/v1/voice-sessions` | Track realtime conversation sessions, transcripts, summaries, and outcomes. |
| Controlled actions | `/api/v1/actions` | Request, authorize, execute, and audit bounded tool actions. |
| Audit | `/api/v1/audit-events` | Read security and operational evidence. |

## Contract rules

- Every tenant-owned endpoint must be tenant-scoped and validate `tenant_id`.
- Auth and authorization follow `ADR-007`.
- Persistence and migrations follow `ADR-008`.
- Contracts must be documented before broad implementation.
- OpenAPI is the review artifact for request/response shape.
- Controllers adapt HTTP to use cases; they do not contain business logic.
- Actions that mutate state must define authorization, audit, idempotency, and error behavior.

## Response conventions

- Success responses return stable JSON objects, not ad-hoc shapes.
- List endpoints use cursor pagination.
- Errors use a Problem Details-style shape with `type`, `title`, `status`, `detail`, `code`, and `correlation_id`.
- Mutating endpoints that can be retried must support `Idempotency-Key`.
- Every response should be traceable through a correlation ID.

## Why not GraphQL first

GraphQL may be useful later for complex admin UI queries. It is not the first MVP contract because AURION needs clear audit boundaries, simple integration semantics, cacheable REST resources, and fast reviewer comprehension.

## Consequences

- Issue #4 can be closed after this ADR and backend API docs are updated.
- Future DTOs, controllers, and OpenAPI decorators must match these groups.
- API work can be split safely by contract group.
- Tests must protect tenant isolation, permissions, idempotency, and error shape before real endpoints expand.

## Out of scope

- Full OpenAPI YAML/JSON generation.
- Realtime WebSocket event contracts.
- Public SDK generation.
- Back-office frontend screens.

Those come after the REST MVP surface is stable.
