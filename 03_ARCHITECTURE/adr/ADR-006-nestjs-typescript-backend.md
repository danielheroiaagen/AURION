---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-01
github_issue: https://github.com/danielheroiaagen/AURION/issues/1
---

# ADR-006 — NestJS + TypeScript backend for MVP

## Decision

AURION Phase 1 will use **NestJS + TypeScript** for the backend foundation.

## Context

The MVP is a Voice Agent SaaS Core with multi-tenant administration, knowledge ingestion, realtime voice sessions, controlled tool execution, audit trails, and metrics.

The original architecture considered FastAPI, but Phase 1 has closed that fork: the MVP backend core is NestJS + TypeScript.

## Options considered

| Option | Strength | Tradeoff |
|--------|----------|----------|
| NestJS + TypeScript | Same language as the frontend, strong module boundaries, dependency injection, testing conventions, OpenAPI support, WebSocket support. | Decorator-heavy; requires discipline to keep domain logic independent from framework modules. |
| FastAPI + Python | Excellent API ergonomics, strong Python AI ecosystem, simple OpenAPI generation. | Splits the MVP across TypeScript frontend and Python backend too early; increases agent context switching. |

## Why NestJS

- AURION already assumes Next.js, React, and TypeScript on the frontend.
- One language across frontend, backend, shared contracts, DTOs, and tooling reduces early complexity.
- NestJS provides a structured Node.js backend model with dependency injection and OpenAPI support, matching the official NestJS documentation for scalable server-side applications and Swagger/OpenAPI integration.
- The framework can sit at the interface/application boundary while the domain remains framework-independent.

## Constraints

- Domain code must not import NestJS decorators, modules, controllers, providers, or SDKs.
- NestJS belongs in application wiring and interface adapters, not business entities.
- API contracts must be documented before broad feature implementation.
- Tests must cover use cases, permissions, and tenant isolation before runtime complexity grows.

## Consequences

- Phase 1 can create a TypeScript monorepo with `apps/api`, `apps/web`, and shared packages.
- Issue #1 can be closed after this ADR and backend docs are updated.
- Future FastAPI use remains possible for specialized AI services, but not for the MVP backend core.

## References

- NestJS official docs: https://docs.nestjs.com/
- NestJS OpenAPI docs: https://docs.nestjs.com/openapi/introduction
