---
project: AURION
document: Phase 8 Voice Gateway Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-10
related: ADR-013, ADR-014, ADR-016, ADR-018
---

# Phase 8 — Realtime voice gateway

Phase 8 builds the conversation runtime (`ADR-018`): the service that holds
the realtime session with the caller, answers from tenant knowledge, asks
AURION for controlled actions (always human-gated — the gateway is a
`voice_agent`), and leaves the full evidence trail in the API. The WebSocket
event contract deferred since ADR-009 is now specified
(`27_VOICE_IVR/websocket-event-contracts.md`).

## Work units

1. `ADR-018`, the WebSocket event contract document, and this plan.
2. Service scaffold `apps/voice-gateway` (runtime dep: `ws` only):
   fail-closed config (`AURION_API_URL`, `VOICE_AGENT_TOKEN`,
   `VOICE_GATEWAY_CLIENT_KEYS`, `BRAIN_MODE`), CI wiring.
3. Domain + engine: conversation state (turns, transcript, summary
   derivation), `ConversationEngine` orchestrating session start → active,
   user turn → brain reply → optional action request
   (`Idempotency-Key: vg:<session>:<turn>`, always `approval_pending`),
   action polling, close with persisted summary, abort → `failed`.
4. Adapters: `ScriptedBrain` (deterministic intents for dev/CI/demo),
   `AurionApiClient` (fetch + bearer + Problem Details awareness),
   WebSocket server (key-gated handshake, one engine per connection,
   protocol errors keep the socket alive, socket close finalizes the
   session).
5. Tests: Vitest suites (engine with fake ports — full flow, idempotent
   turn keys, approval-pending semantics, abort path; scripted brain;
   config fail-closed; protocol parsing); Python contract tests
   `tests/project/test_phase8_voice_gateway.py`.
6. Docs and wiring: CHANGELOG, root scripts, `.env.example` gateway block.

## Acceptance criteria

- [x] The gateway never executes actions: every tool intent becomes a
      requested action reported `approval_pending`; the port has no execute
      method (contract-tested); execution authority stays with humans on
      the dashboard (ADR-013/ADR-014 path).
- [x] Reconnect + replay of the same turn cannot duplicate side effects
      (turn-keyed idempotency, session resume via `external_session_id`).
- [x] A conversation that aborts is closed `failed`; a completed one
      persists a transcript-derived summary (encrypted at rest by the API).
- [x] Startup fails closed on missing API URL, machine token, client keys,
      or unknown brain mode; handshakes without a client key are rejected
      (code 4401).
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope (later phases)

- Realtime speech provider adapters (STT/TTS, speech-to-speech) — the
  `AgentBrainPort` seam is ready for them.
- WebRTC/SIP media (needs a media server; infrastructure phase).
- Signed per-caller call grants, rate limiting at the gateway edge.
- Gateway ↔ API end-to-end suite (lands with docker-compose environments
  in the deployment phase).

## Closure evidence

Local verification passed on branch `phase-8/voice-gateway` (2026-06-10):

- [x] `npm test` passed: **151** Python contract tests (13 new for phase 8).
- [x] `npm run test:api` passed: **126** Jest unit tests (API untouched).
- [x] `npm run test:dashboard` passed: **14** Vitest tests.
- [x] `npm run test:voice-gateway` passed: **13** Vitest tests (engine flow,
      turn-keyed idempotency, approval-pending semantics, abort-as-failed,
      protocol parsing, fail-closed config, scripted intents).
- [x] `npm --workspace @aurion/voice-gateway run typecheck` and `build`
      passed.
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification passed on head `cf818aa` (2026-06-10), PR #22:

- [x] PR opened: `https://github.com/danielheroiaagen/AURION/pull/22`
- [x] All six checks green on the first CI round: verify (now including
      gateway typecheck + tests + build), integration, dependency-audit,
      secret-scan, CodeQL, analyze (javascript-typescript).

Merge evidence:

- [x] PR #22 squash-merged into `main` as `ff71b42` on 2026-06-10 with all
      checks green.

With this phase the full product loop exists in code: caller speaks
(gateway) → agent requests (voice_agent, always gated) → human approves
(dashboard) → dispatcher executes (HERMES port) → evidence audited and
encrypted (API). Remaining tracks are deployment/infrastructure (compose,
VPS, media server for WebRTC/SIP, E2E suites), realtime speech provider
adapters behind AgentBrainPort, the HERMES receiver implementation, and
OIDC PKCE sign-in.
