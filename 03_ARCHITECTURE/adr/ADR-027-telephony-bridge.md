---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-018, ADR-022, ADR-025, ADR-026
---

# ADR-027 — Telephony bridge: a phone number in front of the same engine

## Decision

AURION answers **real phone calls** through a telephony bridge on the
voice gateway — no media server, no new runtime dependencies:

- **Transport: Twilio Media Streams over WebSocket.** The gateway exposes
  a second WS path, **`/twilio`**, speaking Twilio's Media Streams
  protocol (`connected`/`start`/`media`/`stop` frames carrying G.711
  μ-law 8 kHz audio). TwiML for the number:
  `<Connect><Stream url="wss://host/twilio"><Parameter name="key" value="…"/></Stream></Connect>`.
  The `key` custom parameter must match a configured
  `VOICE_GATEWAY_CLIENT_KEYS` entry; calls without it are closed before
  any audio is processed — same no-unauthenticated-mode rule as `/ws`.
- **Streaming STT: a new driven port.** `StreamingTranscriptionPort` —
  `open(handlers, lang) → UtteranceStream` with `push(audio)`/`close()`
  and callbacks `onUtterance(text)`, `onSpeechStarted()`, `onError()`.
  First adapter: `OpenAiRealtimeTranscriber`, a WebSocket **client** to
  the OpenAI Realtime API (`wss://…/v1/realtime?intent=transcription`,
  session type `transcription`) — built on the `ws` package the gateway
  already ships. Caller audio is forwarded **as-is**: the Realtime API
  accepts `audio/pcmu` (μ-law 8 kHz, Twilio's wire format) directly, and
  the provider's `server_vad` decides where utterances end —
  `input_audio_buffer.speech_started` / `…transcription.completed` drive
  the bridge.
- **Voice out: the ADR-026 port, in PCM.** `OpenAiSpeechSynthesizer`
  gains a `pcm` output format; the bridge transcodes PCM16 24 kHz →
  μ-law 8 kHz in ~60 lines of dependency-free JS (`audio.ts`) and ships
  20 ms media frames back to Twilio. `speech_started` during playback
  sends Twilio's `clear` — barge-in v1: the caller can always interrupt.
- **Same engine, same authority.** A phone call runs the SAME
  `ConversationEngine`: `external_session_id = tw-<callSid>` (replay-safe),
  turn-keyed idempotency, actions ALWAYS approval-gated — the caller is
  told the request was registered, never that it ran. The bridge changes
  transport, never authority.
- **Config, fail-closed:** `TELEPHONY_MODE` is `off` (default) or
  `twilio`. `twilio` **requires `STT_MODE=openai` AND `TTS_MODE=openai`**
  and refuses to boot otherwise: a phone call has no text fallback, so a
  gateway that cannot both hear and speak must not answer phones.
  `PHONE_GREETING`, `PHONE_LANG`, and the VAD silence window are
  configurable.

## Context

Phases 14–17 completed the web voice loop (widget ⇄ gateway, server-side
STT and TTS). Meta 2 is a phone number, not a web page: callers dial,
AURION answers. The deferred "media-server phase" turns out not to need a
media server at all for this step — Twilio terminates the call and
streams μ-law over a WebSocket, the OpenAI Realtime API consumes that
exact format, and the `ws` dependency already on board speaks both sides.

## Architectural rules

- **Provider keys never leave the gateway** (ADR-025/026 rule, now for
  calls): Twilio only ever sees the gateway's public WSS URL and the
  client key; OpenAI only ever sees audio.
- **Audio is transient** (ADR-025): caller audio flows Twilio → gateway →
  provider and is dropped; only transcript TEXT enters the conversation
  record. Nothing is recorded to disk.
- **Silence is never an outcome.** Greeting on answer; a failed turn gets
  a spoken apology; a dead STT stream or hangup closes the session record
  (`completed` on `stop`, `failed` on drop) — exactly the ADR-018
  lifecycle, by phone.
- **Fail-closed parsing.** Twilio frames are validated before use;
  malformed frames end the call, unknown-but-wellformed event types are
  ignored (Twilio adds events over time — additive tolerance, same as our
  own contract).

## Consequences

- AURION answers a real phone number as soon as a Twilio number's TwiML
  points at the deployed gateway (phase 19 go-live); until then the
  bridge is fully testable with mocked WS peers, like HERMES was.
- Twilio is the first telephony adapter, not a lock-in: the `/twilio`
  path is one transport handler; a SIP/Telnyx adapter is another handler
  over the same ports.
- Realtime transcription is billed per minute — accepted; the web widget
  path (push-to-talk REST) remains the cheap default for embedded use.
- Out of scope: outbound calls, DTMF menus, call transfer to a human,
  recording/consent flows (legal phase), speech-to-speech models driving
  the conversation directly (they would bypass the approval-gated brain).
