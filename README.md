# AURION — Production-aware Voice Agent SaaS Core

AURION is an AI phone receptionist platform for businesses: it answers calls,
understands the caller, registers controlled actions, waits for human approval,
and records auditable evidence. The repository contains the implemented MVP
core plus the architecture, product, security, and operating documentation that
keeps the system reviewable.

## Current Status

| Area | Status |
|------|--------|
| Product loop | Implemented: caller → voice gateway → API → dashboard approval → Hermes dispatch |
| API | NestJS + TypeScript, PostgreSQL, Kysely, OpenAPI artifact |
| Dashboard | Vite + React SPA with OIDC/PKCE, metrics, approvals, users, knowledge, audit, tenant settings |
| Voice runtime | WebSocket widget, Twilio bridge, OpenAI STT/TTS, HeyGen TTS option, LLM/scripted brain modes |
| Dispatch | HMAC-signed Hermes receiver with stub and n8n connector modes |
| Deployment | Docker Compose stack with API, gateway, receiver, dashboard, landing, Caddy edge, optional Keycloak |
| Verification | Python project contracts, workspace unit tests, integration tests, E2E compose loop, CodeQL, gitleaks, npm audit |

## Quick Start

1. Install dependencies: `npm ci`.
2. Run the repository contract suite: `npm test`.
3. Run the root quality gate: `npm run lint`.
4. Run all workspace typechecks: `npm run typecheck`.

For service-specific checks:

| Command | Purpose |
|---------|---------|
| `npm run test:api` | API unit tests |
| `npm run test:api:integration` | API integration tests against PostgreSQL |
| `npm run test:dashboard` | Dashboard unit tests |
| `npm run test:voice-gateway` | Voice gateway tests |
| `npm run test:widget` | Caller widget tests |
| `npm run test:hermes-receiver` | Hermes receiver tests |
| `npm run e2e` | Full Docker Compose product loop |

## Monorepo Map

| Path | Role |
|------|------|
| `apps/api` | NestJS API, auth, tenant-scoped resources, actions, metrics, audit |
| `apps/dashboard` | Admin/operator dashboard for approvals, metrics, users, knowledge, audit, tenant launch readiness |
| `apps/widget` | Zero-dependency embeddable browser voice widget |
| `apps/voice-gateway` | Conversation runtime, LLM brain, STT/TTS, Twilio bridge, cost guards |
| `apps/hermes-receiver` | Signed action dispatch receiver and connector boundary |
| `apps/landing` | Static marketing site with GDPR-aware demo intake |
| `database/migrations` | PostgreSQL schema, RLS, audit hardening |
| `docker` | Service images and Caddy edge config |
| `tests/project` | SDD/ADR contract tests that protect product decisions |
| `03_ARCHITECTURE/adr` | Accepted architecture decision records |
| `26_PROJECT_MANAGEMENT` | Phase plans and closure evidence |

## Architecture

AURION follows a controlled-action architecture:

1. A caller speaks through the web widget or a Twilio phone line.
2. The voice gateway runs the conversation and may register an action intent.
3. The API stores the action as `requested`; the gateway never executes side effects.
4. A human reviews the action in the dashboard and approves or rejects it.
5. Execution goes through the dispatch port into Hermes receiver.
6. Evidence returns to the API and is stored with auditability and tenant isolation.

Security boundaries are intentional:

- JWT/JWKS authentication with issuer/audience pinning.
- Tenant-scoped RBAC and PostgreSQL RLS.
- Append-only audit evidence.
- AES-256-GCM encryption for sensitive payloads and summaries.
- HMAC signatures for API → Hermes dispatch.
- Provider keys stay server-side; the browser never sees STT/TTS/LLM secrets.

## Operating Modes

| Mode | Purpose |
|------|---------|
| `BRAIN_MODE=scripted` | Deterministic local/CI/demo conversations |
| `BRAIN_MODE=llm` | OpenAI-compatible Chat Completions brain with tool catalog |
| `STT_MODE=openai` | Server-side speech-to-text |
| `TTS_MODE=openai` | Server-side OpenAI TTS |
| `TTS_MODE=heygen` | Daniel/operator cloned voice via HeyGen |
| `TELEPHONY_MODE=twilio` | Real phone calls through Twilio Media Streams |
| `CONNECTOR_MODE=stub` | Honest simulated connector evidence |
| `CONNECTOR_MODE=n8n` | Real workflow execution through n8n |

## Documentation Discipline

AURION uses SDD-style project contracts:

- Every substantive technical decision gets an ADR in `03_ARCHITECTURE/adr/`.
- Every implementation phase has a plan in `26_PROJECT_MANAGEMENT/`.
- Every product/architecture contract has Python tests in `tests/project/`.
- The OpenAPI artifact in `32_API_REFERENCE/openapi.json` is generated and checked for drift.
- User-facing, architectural, security, and commercial changes update the relevant docs in the same work unit.

Start here when changing the system:

| Need | Read First |
|------|------------|
| Architecture | `03_ARCHITECTURE/architecture.md`, then the relevant ADR |
| Backend/API | `19_BACKEND/README.md`, `19_BACKEND/api-design.md`, `32_API_REFERENCE/openapi.json` |
| Frontend/dashboard | `18_FRONTEND/README.md`, `20_DESIGN_SYSTEM/design-tokens.md` |
| Voice/telephony | `27_VOICE_IVR/voice-product-spec.md`, ADR-024 through ADR-035 |
| Deployment | `10_DEPLOYMENT/vps-deploy-runbook.md`, `docker-compose.yml` |
| Sales readiness | `26_PROJECT_MANAGEMENT/phase-25-sales-ready-plan.md` |

## Professional Readiness Checklist

- [x] Root quality commands are real: `npm run lint`, `npm run typecheck`.
- [x] CI runs tests, workspace builds, typechecks, OpenAPI drift checks, integration, E2E, dependency audit, secret scan, and CodeQL.
- [x] Dashboard and landing share the AURION deep-ocean futurist visual system.
- [x] Landing has privacy/cookie/legal pages and structured demo intake.
- [x] Product loop is demonstrable end to end without pretending stub connectors are real.
- [ ] Production connector credentials are configured per client in n8n.
- [ ] Spanish production phone number is acquired before charging Spanish clients for forwarded calls.
- [ ] Billing/pricing enforcement is added after the commercial package is finalized.

## Repository Rule

Do not add hidden side effects. If AURION cannot execute a real action, the UI,
API, connector evidence, and docs must say so explicitly.
