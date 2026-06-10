---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-004, ADR-017, ADR-018, ADR-023
---

# ADR-024 — Caller voice widget (browser-native speech)

## Decision

The end-customer surface is `apps/widget`: an embeddable, **zero-runtime-
dependency** vanilla-TypeScript widget that holds a voice conversation with
AURION using **browser-native speech** — `SpeechRecognition` for the
caller's voice, `speechSynthesis` for the agent's replies — over the
**existing WebSocket event contract** (ADR-018). Speech stays local to the
browser; what crosses the wire is exactly the text-turn protocol the
gateway already speaks. When speech APIs are unavailable (or the caller
prefers it), the widget falls back to text seamlessly — same protocol,
same conversation.

**A media server is deliberately NOT introduced.** WebRTC media
infrastructure (LiveKit or similar) becomes necessary when telephony (SIP)
or server-side audio processing lands — that phase gets its own ADR. The
widget is the seam: swapping browser speech for a media stream changes the
audio layer only, never the conversation protocol.

## Context

The product loop is complete (gateway → approval → dispatch → evidence),
but the caller's entry point was a raw WebSocket. ADR-004's promise — a
customer talks naturally and the agent safely acts — needs a surface a
human can actually use. Browser speech APIs make a real voice MVP possible
with zero new infrastructure and zero new protocol: recognition quality is
the platform's (excellent on Chromium/WebKit), and the graceful-degradation
path doubles as accessibility.

## Design

- **Zero runtime dependencies** (the dashboard rule, taken further: not
  even a framework). One Vite build, one embeddable bundle plus a demo
  page. Styling is scoped and minimal.
- **`conversation-client.ts`** is the only WebSocket door: typed mirror of
  the ADR-018 events, callback-driven, with reconnect-resume — the
  `external_session_id` persists in `sessionStorage`, so a dropped tab
  resumes the same conversation record (the gateway's natural idempotency
  does the rest).
- **`speech.ts`** wraps recognition/synthesis behind tiny interfaces with
  explicit availability detection — the UI renders the mic only when the
  platform can listen; everything is testable with mocked globals.
- **Action transparency**: when the agent registers an action, the widget
  tells the caller it awaits human approval (`approval_pending` is part of
  the protocol) and lets them poll the outcome — the honesty rule of
  ADR-013 carried to the end user.
- **Configuration**: gateway URL + client key, provided by the embedding
  page (demo page exposes inputs). The client key remains transport
  gating (ADR-018); per-caller signed grants stay a deployment-phase item.

## Consequences

- The widget joins the npm workspaces and CI verify (typecheck, vitest,
  build). It is NOT yet wired into compose/Caddy: embedding happens on the
  customer's site; the demo page covers evaluation. Hosting the bundle on
  the edge is a one-line Caddy addition documented in the runbook when
  needed.
- Browser support honesty: `SpeechRecognition` is Chromium/WebKit; Firefox
  callers get the text fallback automatically. This is recorded, not hidden.
- Out of scope: telephony/SIP and the media-server ADR, barge-in,
  wake-words, multilingual voice selection UI, theming API.
