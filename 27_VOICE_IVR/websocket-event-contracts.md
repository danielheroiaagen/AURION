---
project: AURION
document: Voice Gateway WebSocket Event Contracts
folder: 27_VOICE_IVR
owner: Daniel Gonzalez Junco
status: active
created_at: 2026-06-10
related: ADR-009, ADR-013, ADR-018
---

# Voice gateway WebSocket event contracts

The realtime event protocol between voice clients (browser widget, future
telephony bridges) and `apps/voice-gateway` (ADR-018). This is the contract
ADR-009 deferred. Every frame is a JSON object with a `type` field; unknown
types are answered with `error` and the connection stays open.

## Handshake

`GET /ws?key=<client key>` — upgraded only when `key` matches one of the
gateway's configured `VOICE_GATEWAY_CLIENT_KEYS`. Connections without a
valid key are closed with WebSocket code `4401` before any event is read.

One connection = at most one conversation.

## Client → server

| Type | Payload | Semantics |
|------|---------|-----------|
| `session.start` | `external_session_id?` | Begin the conversation. Replaying the same `external_session_id` resumes idempotently (ADR-013 natural idempotency). |
| `turn.user` | `text` | One caller utterance. The gateway answers with `turn.agent`, possibly preceded by `action.requested`. |
| `action.poll` | `action_id` | Ask for the current status of a previously requested action. |
| `session.end` | `outcome?` | Close the conversation. The gateway persists the summary and confirms with `session.ended`. |

## Server → client

| Type | Payload | Semantics |
|------|---------|-----------|
| `session.started` | `session_id` | The API session is live (`active`). |
| `turn.agent` | `text` | The agent's reply for the last user turn. |
| `action.requested` | `action_id`, `action_type`, `approval_pending: true` | The agent asked AURION to do something. The gateway is a `voice_agent`: execution ALWAYS awaits human approval (ADR-007/ADR-013) — the caller is told the request was registered, never that it ran. |
| `action.update` | `action_id`, `status` | Answer to `action.poll` (`requested`, `approved`, `rejected`, `executed`, `failed`). |
| `session.ended` | `session_id`, `status` | Lifecycle closed (`completed`, or `failed` on abort). |
| `error` | `code`, `message` | Protocol or upstream failure. `code` is stable (`bad_message`, `no_session`, `session_already_started`, `upstream_failed`). |

## Ordering and delivery rules

- Events for one connection are emitted in order; a `turn.agent` always
  follows its `turn.user`, with any `action.requested` in between.
- A dropped connection does NOT end the conversation record: the client may
  reconnect and `session.start` with the same `external_session_id`; action
  requests are turn-keyed (`vg:<session_id>:<turn>`) so replays never
  duplicate side effects.
- The gateway closes sessions it cannot continue as `failed` — silence is
  never an outcome.

## Extension points (additive, not breaking)

- `audio.frame` / `audio.transcript` event types for streamed audio once a
  realtime speech provider adapter lands (ADR-018).
- Signed per-caller call grants in the handshake (deployment phase).
