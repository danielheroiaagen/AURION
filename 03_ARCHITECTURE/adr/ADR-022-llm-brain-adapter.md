---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-013, ADR-018
---

# ADR-022 — LLM brain adapter behind AgentBrainPort

## Decision

The voice gateway gains a real model adapter: `LlmBrain`, selected with
`BRAIN_MODE=llm`, speaking the **OpenAI-compatible Chat Completions
protocol** (works with OpenAI, Azure OpenAI, and any compatible local or
hosted endpoint) using plain `fetch` — no SDK enters the supply chain.

Tool use maps onto the existing safety model 1:1:

- The model is offered exactly two tools — `ticket.create` and
  `calendar.update` — mirroring the `ACTION_TYPES` catalog. A tool call in
  the model response becomes a `ToolIntent`; **everything downstream is
  unchanged**: the engine requests an approval-gated action (the gateway is
  a `voice_agent`), humans approve on the dashboard, the dispatcher
  executes. The model never gains an execute path because no such path
  exists in the gateway (ADR-018).
- A tool call the catalog does not contain is dropped and answered
  conversationally — the model cannot mint new capabilities.

## Context

`AgentBrainPort` (ADR-018) was designed for exactly this: `ScriptedBrain`
proved the loop deterministically; production needs a model that
understands the caller. The Chat Completions protocol is the most widely
implemented standard, future provider quirks live inside this one adapter.

## Design

- **Fail-closed config**: `BRAIN_MODE=llm` requires `LLM_API_URL` (https,
  or plain http only for localhost/private use at the operator's explicit
  choice), `LLM_API_KEY`, and `LLM_MODEL`. Optional: `LLM_TIMEOUT_MS`
  (default 30 000), `LLM_MAX_TOKENS` (default 300).
- **Prompt discipline**: the system prompt pins the agent's role, injects
  the tenant's published knowledge titles, and instructs honesty about the
  approval flow ("requests are registered for human approval, never
  executed immediately"). Transcript turns map to user/assistant messages.
- **Failure semantics mirror the dispatcher**: timeout (AbortController),
  non-2xx, or malformed responses raise `BrainError`; the WS layer answers
  the caller with the stable `upstream_failed` error event and the
  conversation record stays consistent — a model outage never fabricates a
  reply or an intent.
- **Privacy boundary**: the adapter sends transcript text and knowledge
  TITLES only — never payload contents of previous actions, never tenant
  settings, never tokens. What leaves the boundary is exactly what the
  caller said.

## Consequences

- `ScriptedBrain` remains the default (`BRAIN_MODE=scripted`) for dev/CI/E2E
  — deterministic tests stay deterministic; `llm` is opt-in per deployment.
- Realtime speech-to-speech (audio in/out) remains a future adapter behind
  the same port plus `audio.*` protocol events (ADR-018 extension points);
  this ADR covers the text-turn brain.
- Out of scope: streaming partial replies, conversation-history windowing
  beyond simple truncation, per-tenant prompt customization (needs tenant
  settings surface), model fallback chains.
