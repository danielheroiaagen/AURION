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
- ADR-023 metrics & supervision: tenant-scoped
  `GET /api/v1/metrics/overview` (new `metrics:read` permission; SQL
  aggregates inside RLS; rates are `null` on zero denominators, approval
  rate counted from decision stamps rather than current status) and a
  dashboard Overview landing page (KPI cards, CSS-only bars, 30s
  auto-refresh) plus a live pending-approvals badge in the navigation.
- ADR-022 LLM brain adapter (`BRAIN_MODE=llm`): OpenAI-compatible Chat
  Completions over plain fetch (no SDK); the model is offered exactly the
  `ACTION_TYPES` tool catalog — tool calls become approval-gated action
  requests through the unchanged safety path, unknown tools are dropped
  (the model cannot mint capabilities); upstream failures surface as
  `upstream_failed`, never fabricated replies. `scripted` stays the
  deterministic default for dev/CI/E2E.
- ADR-021 dashboard OIDC sign-in: Authorization Code + PKCE (S256,
  WebCrypto) as a public client — no client secret exists in the dashboard;
  single-use state/verifier attempts rejected before any network call on
  mismatch; the access token enters through the same API-validated
  `signIn()` door; manual token paste stays as the explicit dev fallback.
- ADR-020 containerized deployment: multi-stage non-root images for all
  four services, one compose stack (postgres + one-shot migrate + api +
  receiver + gateway, `full` profile adds dashboard + single-origin Caddy
  edge), VPS runbook, and an end-to-end CI harness (`npm run e2e`) that
  drives the REAL product loop across containers: WS conversation →
  approval-pending action → human approval → HMAC-signed dispatch into the
  receiver → stub evidence encrypted at rest → session completed with
  summary. Plain-http dispatch to private networks now requires the
  explicit `HERMES_DISPATCH_ALLOW_INSECURE_HTTP` flag.
- ADR-019 HERMES dispatch receiver (`apps/hermes-receiver`):
  zero-runtime-dependency Node service implementing the receiver contract —
  constant-time HMAC verification over raw bytes BEFORE parsing, 300s
  staleness window on the signed timestamp, at-most-once execution per
  `action_id` (replay returns the original evidence), explicit 422 for
  unknown action types, stub connectors stamped `connector_mode: "stub"`.
- ADR-018 realtime voice gateway (`apps/voice-gateway`): dependency-light
  Node service (runtime dep: `ws` only) orchestrating conversations over the
  WebSocket event contract deferred since ADR-009
  (`27_VOICE_IVR/websocket-event-contracts.md`). The gateway is a
  `voice_agent`: tool intents become approval-pending action requests with
  turn-keyed idempotency (`vg:<session>:<turn>`); it has no execute path.
  Sessions close `completed` with a transcript-derived summary or `failed`
  on abrupt drops — silence is never an outcome. `ScriptedBrain` is the
  deterministic dev/CI adapter behind `AgentBrainPort`; realtime model
  providers plug in behind the same port.
- ADR-017 admin dashboard (`apps/dashboard`): Vite + React SPA with a
  minimal runtime dependency tree (react, react-dom, react-router-dom);
  sessionStorage-held bearer sessions (401 = session death, claims are UX
  hints only); typed API client mirroring the OpenAPI artifact; pages for
  the human approval workflow (approve/reject/execute with ADR-013 authority
  rules mirrored client-side), users/memberships, knowledge lifecycle,
  voice sessions, audit evidence, and tenant settings.

### Changed

- **Breaking**: `POST /api/v1/actions/:id/execute` no longer accepts a client
  `result_payload` (ADR-014) — execution evidence can only originate at the
  dispatcher boundary.
- `integration` added to the required status checks on `main`.
