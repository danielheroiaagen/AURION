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
- ADR-025 server-side speech-to-text (`STT_MODE=openai`): the gateway
  transcribes recorded caller utterances through a `TranscriptionPort`
  (OpenAI `/audio/transcriptions` via plain fetch — runtime deps stay
  `ws`-only) and runs the SAME approval-gated turn path; new additive WS
  events `audio.utterance`/`audio.transcript` + `stt_enabled` flag. The
  widget records push-to-talk audio locally (`MediaRecorder`) and never
  sees the provider key; Chrome's failing online recognizer is demoted to
  fallback. This removes the root cause of the broken mic that phase 15
  made diagnosable.
- ADR-026 server-side text-to-speech (`TTS_MODE=openai`): the gateway
  voices every agent reply through a `SpeechSynthesisPort` (OpenAI
  `/audio/speech` via plain fetch — runtime deps stay `ws`-only); new
  additive WS event `audio.agent` + `tts_enabled` flag, stable error code
  `tts_failed`. Text is the source of truth: `turn.agent` is always
  delivered before (and despite) any synthesis failure. The widget plays
  finished audio (zero deps) and demotes the browser's `speechSynthesis`
  to fallback; the HeyGen avatar is deferred to its own media-channel
  phase on this seam.
- ADR-027 telephony bridge (`TELEPHONY_MODE=twilio`): AURION answers real
  phone calls. A second `/twilio` WS path speaks Twilio Media Streams
  (G.711 μ-law 8 kHz, key-gated via TwiML `<Parameter>`); a new
  `StreamingTranscriptionPort` adapter feeds the OpenAI Realtime API
  (`audio/pcmu` as-is, server VAD) and replies are voiced through the
  ADR-026 synthesizer with a dependency-free PCM→μ-law transcode.
  Barge-in v1 (`clear` on caller speech), greeting on answer, spoken
  apology on a failed turn. SAME conversation engine and approval-gated
  actions — the bridge changes transport, never authority. Fail-closed:
  twilio mode refuses to boot without STT and TTS both in openai mode.
- ADR-034 sales-ready guards: `CallCapacity` cost guard for paid
  traffic — concurrent and daily call caps enforced at the TwiML front
  door with a language-aware busy message spoken by Twilio's own TTS
  (over-limit calls never touch billed providers); bridge accounting and
  logged refusals. AI-disclosure greeting deployed alongside.
- ADR-033 self-hosted IdP: Keycloak as a compose service (`--profile
  idp`, /auth behind the edge, schema in the aurion postgres) closes the
  go-live hs256 exception. Realm bootstrap is a reviewable kcadm script
  (PKCE dashboard client; confidential voice-gateway client with
  hardcoded actor_type/tenant_id mappers; audience aurion-api). The
  gateway now mints its own short-lived machine tokens
  (client_credentials, cached, single-flight, early refresh) instead of
  holding a 365-day JWT; config fail-closed on exactly one identity
  mechanism.
- ADR-032 realtime voice v2: phone turns drop from ~5-7s to ~2s to the
  first spoken word. Brain latency governed by model choice
  (gpt-5.4-mini measured ≈0.9s with tools vs ≈4s on gpt-5.5; the dead
  reasoning_effort lever removed — it 400s with tools), streaming TTS
  (μ-law frames ship as PCM renders), streaming-first call STT
  (`TELEPHONY_STT_MODEL=gpt-realtime-whisper` with adapter-side energy
  VAD, manual commits, barge-in preserved), and an echo guard so the
  agent's own voice never becomes a caller turn (ghost turn observed
  live).
- ADR-031 design v2 "deep ocean futurist": the dashboard adopts Tailwind
  v4 + copied-in shadcn-style components (Button/Card/Badge/Inputs,
  lucide icons) themed from one `@theme` token source — abyssal palette,
  cyan→violet AI gradient, aurora + circuitry-grid atmosphere, glass
  surfaces, Linear-tight type, glowing status dots. Legacy class names
  remain stable contracts (every screen reskinned without breakage); the
  caller widget keeps its zero-dependency stylesheet on the same v2
  tokens.
- ADR-030 real connectors as n8n workflows (`CONNECTOR_MODE=n8n`): the
  action catalog grows to four types end to end (`ticket.create`,
  `calendar.update`, `email.send`, `whatsapp.send` — API catalog,
  permissions, matrix, LLM/scripted brains, OpenAPI) and HERMES executes
  them as workflows on the operator's own n8n (one typed webhook per
  action, credentials in n8n's vault, evidence stamped
  `connector_mode: "n8n"`, failures surface as `connector_failed`).
  Importable workflow skeletons whose default evidence honestly says
  `pending-configuration` until real provider nodes are wired.
- ADR-029 operator cloned voice (`TTS_MODE=heygen`): the agent can speak
  with Daniel's own HeyGen-cloned voice on BOTH channels — the widget
  plays the MP3 natively, the phone decodes it through the ffmpeg system
  binary now shipped in the gateway image (npm deps stay `ws`-only).
  Fail-closed: heygen mode requires the key and the voice id; telephony
  with heygen TTS refuses to boot without ffmpeg.
- ADR-028 signed TwiML endpoint + go-live edge: `POST /twiml` on the
  gateway returns the phone number's connect TwiML ONLY for requests
  carrying a valid `X-Twilio-Signature` (HMAC-SHA1 over the pinned
  `TELEPHONY_PUBLIC_URL`, constant-time compare) — the client key is
  never served to anyone but Twilio. Caddyfile parametrized with
  `CADDY_DOMAIN` (automatic TLS on the VPS) and routes `/twilio` +
  `/twiml` to the gateway.
- Design tokens v1 "deep ocean" (`20_DESIGN_SYSTEM/design-tokens.md`,
  implemented): one palette/type/interaction language for dashboard and
  widget, CSS-only (no class renames, no new dependencies), visible
  keyboard focus everywhere, status colors always paired with text.
- Widget mic diagnostics: capture failures are never silent — each reason
  (`not-allowed`, `no-speech`, `network`, `unavailable`) renders a specific
  on-screen explanation with the text fallback offered.
- Demo tooling: `tools/demo/run-demo.mjs` (full-stack bring-up with seeded
  tenant + live approval workflow) and `tools/demo/mic-check.mjs`
  (live gateway round-trip).
- ADR-024 caller voice widget (`apps/widget`): embeddable
  zero-runtime-dependency vanilla-TS widget (2.5 kB gzip) holding a real
  voice conversation via browser-native speech (recognition + synthesis
  stay local; the wire carries the existing ADR-018 text-turn protocol),
  reconnect-resume via `external_session_id`, approval-pending transparency
  surfaced to the caller, automatic text fallback where speech is
  unavailable. The media server (WebRTC/SIP) is explicitly deferred to the
  telephony phase with its own ADR.
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
