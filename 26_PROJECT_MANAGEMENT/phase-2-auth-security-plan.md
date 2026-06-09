---
project: AURION
document: Phase 2 Auth & Security Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-10
related: ADR-007, ADR-008, ADR-009, ADR-010, ADR-011
---

# Phase 2 — Authentication, Authorization & Security Hardening

Phase 2 turns the documented security model into enforced code. It implements
the auth boundary (`ADR-007`), the API edge controls (`ADR-010`), and database
and data-at-rest protections (`ADR-011`), and closes the security findings
raised in the Phase 1 hardening follow-up.

## Decision

Implement, on top of the Phase 1 foundation:

1. **JWT authentication + tenant-scoped RBAC + deny-by-default policy guard**.
2. **Database-level tenant isolation (RLS) and append-only audit**.
3. **HTTP edge hardening**: Helmet, CORS allowlist, rate limiting, Problem
   Details errors, correlation ids.
4. **Supply-chain and scanning controls** in CI: dependency audit, secret
   scanning, CodeQL, Dependabot, SHA-pinned actions.

## Risk-to-control mapping

| Finding (Phase 1 review) | Severity | Control delivered |
|--------------------------|----------|-------------------|
| Tenant isolation only in app code | High | RLS on all tenant-owned tables (migration `0002`). |
| Audit log not append-only | Medium | DB trigger blocks update/delete on `audit_events`. |
| No HTTP hardening | Medium | Helmet, CORS allowlist, throttler, Problem Details filter. |
| PII at rest in plaintext | Medium | `ADR-011`: RLS now; column encryption + redaction at persistence. |
| No CI security scanning / floating actions | Low | `npm audit`, gitleaks, CodeQL, Dependabot, SHA-pinned actions. |

## Work units

1. Security migration `0002` (RLS + audit immutability) and database docs.
2. Auth module: domain (roles, permissions, matrix, actor), application
   (PolicyService + audit port), infrastructure (HS256 JWT verifier, guards,
   audit sink), decorators; global guards wired deny-by-default.
3. Edge hardening in `main.ts` / `app.module.ts` and shared `common/` utilities.
4. CI security workflows, Dependabot, SECURITY.md, `.env.example`.
5. Tests: Jest unit suite for auth + Python contract tests for the phase.
6. ADR-010, ADR-011, and this plan.

## Acceptance criteria

- [x] RLS enabled and forced on every tenant-owned table.
- [x] `audit_events` is append-only at the database layer.
- [x] JWT authentication verifies HS256, pins the algorithm, and fails closed.
- [x] PolicyService enforces deny-by-default, tenant scope, RBAC, and human
      approval, and emits audit evidence for sensitive decisions.
- [x] Health endpoint remains public; all other routes require a valid identity.
- [x] Helmet, CORS allowlist, rate limiting, Problem Details, and correlation
      ids are applied globally.
- [x] CI runs dependency audit, secret scanning, and CodeQL with SHA-pinned
      actions; Dependabot configured.
- [x] Jest unit tests and Python contract tests cover the above.
- [x] `npm ci`, `npm test`, `npm run test:api`, typecheck, and build all pass
      locally with 0 vulnerabilities (CI parity pending push).

## CI gates

`.github/workflows/ci.yml` runs install, project tests, **API unit tests**,
typecheck, and build. `.github/workflows/security.yml` runs `npm audit` and
gitleaks. `.github/workflows/codeql.yml` runs static analysis. All three run on
PR and push to `main`, plus a weekly schedule.

## Configuration

The API now requires security configuration. See `.env.example`:
`JWT_SECRET` (required), `JWT_ISSUER`, `JWT_AUDIENCE`, `CORS_ORIGINS`,
`RATE_LIMIT_TTL_SECONDS`, `RATE_LIMIT_MAX`.

## Out of scope (next phases)

- First tenant-scoped REST resources (tenants, knowledge, voice sessions, actions).
- Persistence layer (Kysely + node-postgres) and the DB-backed audit adapter.
- Column-level encryption implementation (decided in `ADR-011`).
- External IdP / RS256 + JWKS (follow-up ADR).

## Closure evidence

Local verification passed on branch `phase-2/auth-security` (2026-06-10):

- [x] `npm install` completed with **0 vulnerabilities** (613 packages).
- [x] `npm test` passed: **51** Python contract tests.
- [x] `npm run test:api` passed: **36** Jest unit tests (3 suites).
- [x] `npm --workspace @aurion/api run typecheck` passed.
- [x] `npm --workspace @aurion/api run build` passed; `dist/` contains no spec files.
- [x] `npm audit --omit=dev --audit-level=high` reported 0 vulnerabilities.
- [x] Runtime smoke test: API fails closed without `JWT_SECRET`; `/api/v1/health`
      returns 200 with Helmet headers and a correlation id; unknown routes return
      a Problem Details `application/problem+json` 404.

Remaining for closure: push the branch, confirm CI (verify + security + CodeQL),
open the PR, and append CI run links.
