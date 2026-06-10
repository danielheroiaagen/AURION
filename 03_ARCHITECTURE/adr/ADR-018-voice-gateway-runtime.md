---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-001, ADR-004, ADR-007, ADR-009, ADR-013, ADR-014
---

# ADR-018 — Realtime voice gateway runtime

## Decision

The realtime conversation runtime is a **separate service**,
`apps/voice-gateway`: a small dependency-light Node/TypeScript process
(runtime dependency: `ws` only — no NestJS, no LLM SDKs) that orchestrates
conversations over a **WebSocket event protocol** and uses the AURION API as
its only system of record.

Three boundaries, all ports (ADR-001):

1. **Client transport** — WebSocket sessions speaking the event contract in
   `27_VOICE_IVR/websocket-event-contracts.md` (the contract ADR-009
   deferred). The MVP exchanges **text turns**; audio frames are an additive
   event type, not a protocol break.
2. **`AgentBrainPort`** — produces the agent's reply (and optional tool
   intent) from the conversation context plus the tenant's published
   knowledge. First adapter: `ScriptedBrain`, deterministic, for
   development/CI. Realtime model providers (e.g. speech-to-speech APIs)
   are future adapters behind the same port — `BRAIN_MODE` selects, fail
   closed on unknown modes.
3. **`AurionApiPort`** — the AURION REST API with a `voice_agent` machine
   token: start/advance/close voice sessions, read published knowledge,
   request controlled actions, poll their status.

## Context

The backend (phases 0–6) records sessions and gates actions; the dashboard
(phase 7) gives humans the approval surface. Nothing yet *holds a
conversation*. The runtime must exist as its own process because its
operational profile (long-lived stateful connections, media later) is the
opposite of the stateless API's — ADR-003 already separates the realtime
runtime from everything else for exactly this reason.

## Architectural rules

- **The gateway holds no business state.** Every fact that matters —
  session lifecycle, transcript summary, requested actions, audit evidence
  — lives in the API. A crashed gateway loses a socket, never a record.
- **The gateway is a `voice_agent`, with everything that implies.** Its
  token carries `actor_type: voice_agent`; the policy decision point
  therefore forces human approval on every tool execution (ADR-007/ADR-013).
  The gateway **requests** actions and reports `approval_pending` to the
  caller; it never executes them — execution happens from the dashboard
  after a human decision, through the dispatcher (ADR-014). The runtime
  cannot escalate itself by design.
- **Turn-keyed idempotency.** Action requests use
  `Idempotency-Key: vg:<session_id>:<turn>` so a reconnect/retry of the same
  conversational turn can never duplicate a side effect (ADR-013 replay
  semantics do the rest).
- **Session lifecycle mapping**: client connect + `session.start` →
  API `started` → `active`; client `session.end` (or socket close) →
  `completed` with the transcript-derived summary, or `failed` when the
  conversation aborts. The natural idempotency of `external_session_id`
  makes gateway restarts safe.
- **Fail-closed startup**: `AURION_API_URL`, `VOICE_AGENT_TOKEN`, and at
  least one client connection key (`VOICE_GATEWAY_CLIENT_KEYS`) are
  required; unknown `BRAIN_MODE` refuses to boot. WebSocket handshakes
  without a configured client key are rejected before any session exists.

## Consequences

- The client key is transport gating for the MVP (browser widget ↔ gateway);
  per-caller identity, rate limiting and signed call grants arrive with the
  deployment/infra phase. The handshake is the seam.
- Audio: STT/TTS or speech-to-speech providers plug in behind
  `AgentBrainPort` without protocol changes (new `audio.*` event types).
  **WebRTC/SIP need a media server (e.g. LiveKit) and belong to the
  infrastructure phase** — this gateway is the orchestration tier those
  media sessions will drive.
- The ScriptedBrain makes the whole conversation loop testable end to end
  (deterministic intents) and doubles as the demo mode; it is honest about
  itself the same way the noop dispatcher is.
- Out of scope: multi-gateway session handover, conversation analytics,
  barge-in/interruption semantics, and the realtime provider adapters
  themselves.
