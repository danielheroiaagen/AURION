---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
supersedes: none
related: ADR-007, ADR-009
---

# ADR-010 — API edge security and hardening

## Decision

The AURION API enforces a hardened HTTP edge for every request, in addition to
the authentication and authorization boundary defined in `ADR-007`.

The edge controls are: **security headers (Helmet)**, an **explicit CORS
allowlist**, **rate limiting**, a **Problem Details exception filter**, and a
**correlation id** on every request and response.

## Why

A signed JWT and a policy guard answer "who are you" and "can you do this". They
do not protect against header-based attacks, browser cross-origin abuse, brute
force / flooding, leaking internals through error messages, or untraceable
incidents. Those are edge concerns and must be solved once, globally, not per
endpoint.

## Controls

| Control | Implementation | Rationale |
|---------|----------------|-----------|
| Security headers | `helmet()` in `apps/api/src/main.ts` | HSTS, no-sniff, frameguard, etc. by default. |
| CORS | `enableCors` with `CORS_ORIGINS` allowlist | No allowlist means no cross-origin access (fail closed). |
| Rate limiting | `@nestjs/throttler` global guard | Sheds floods/brute force; configurable via env. |
| Error contract | Global `ProblemDetailsFilter` | RFC 9457 shape (`ADR-009`); never leaks stack traces or internals on 5xx. |
| Traceability | `CorrelationIdMiddleware` | Honors a safe `X-Correlation-Id` or generates one; echoed in responses and audit. |
| Fail closed startup | `loadSecurityConfig` | API refuses to start without a strong `JWT_SECRET`. |
| Input validation | Global `ValidationPipe` (whitelist + forbidNonWhitelisted) | Rejects unknown/extra fields. |

## Configuration contract

All edge behavior is configured through the environment (see `.env.example`):

- `JWT_SECRET` (required, ≥ 32 chars), optional `JWT_ISSUER`, `JWT_AUDIENCE`.
- `CORS_ORIGINS` (comma-separated allowlist).
- `RATE_LIMIT_TTL_SECONDS`, `RATE_LIMIT_MAX`.

## Consequences

- Controllers and use cases stay focused on business logic; cross-cutting
  protection lives at the edge.
- Production deployments must set the security environment variables explicitly;
  there is no insecure default.
- When a reverse proxy terminates TLS and sets headers, the Helmet/CORS strategy
  is revisited so controls are applied exactly once.

## Out of scope

- Web Application Firewall / DDoS protection at the network edge.
- Per-tenant or per-actor rate limit tiers (follow-up once usage data exists).
- mTLS between internal services.
