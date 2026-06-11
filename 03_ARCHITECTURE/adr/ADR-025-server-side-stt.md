---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-018, ADR-022, ADR-024
---

# ADR-025 — Server-side speech-to-text behind a gateway port

## Decision

Caller speech is transcribed **server-side, by the voice gateway**, through
a new driven port:

- **`TranscriptionPort`** — `transcribe(audio, mimeType, lang) → text`.
  First adapter: `OpenAiTranscriber`, calling the OpenAI
  `POST /v1/audio/transcriptions` endpoint with plain `fetch` + native
  `FormData`/`Blob` — **no SDK**, the gateway's runtime dependency set stays
  `ws` only (ADR-018).
- **Two additive WS events** (the extension point reserved in
  `27_VOICE_IVR/websocket-event-contracts.md`):
  - client → server `audio.utterance` `{ audio: base64, mime_type, lang? }`
    — one push-to-talk capture, size-capped;
  - server → client `audio.transcript` `{ text }` — what the gateway
    understood, echoed before the normal `turn.agent` flow runs on it.
- **`session.started` gains `stt_enabled: boolean`** so the widget knows
  honestly whether the gateway can listen. When STT is off, `audio.utterance`
  is answered with stable error code `stt_disabled` and the widget falls
  back to its existing local capture / text input (ADR-024).
- **Config, fail-closed** (same pattern as `BRAIN_MODE`): `STT_MODE` is
  `off` (default) or `openai`; `openai` requires `STT_API_KEY` and refuses
  to boot without it. `STT_MODEL` defaults to `gpt-4o-transcribe`,
  `STT_API_URL` to `https://api.openai.com/v1`; timeout and a hard audio
  size cap are configurable.

## Context

The phase 14 widget captures speech with the browser's `SpeechRecognition`
(ADR-024). In Chrome that is a Google **online** service which now fails
with `network` errors on many desktop installs — phase 15 made the failure
visible per reason, but no client-side change can fix it. The fix is to
move STT to infrastructure we control: the widget records audio locally
(`getUserMedia` + `MediaRecorder`, both local browser APIs) and ships the
utterance to the gateway, which owns the provider call.

## Architectural rules

- **The OpenAI key never reaches the browser.** It lives only in the
  gateway's environment; the widget keeps exactly zero secrets beyond the
  existing client connection key.
- **Audio is transient.** The gateway forwards the utterance to the
  provider and drops it; nothing but the recognized TEXT enters the
  conversation, the API record, or logs — the ADR-022 privacy boundary
  (transcript text + knowledge titles) is unchanged.
- **Same turn semantics.** A transcribed utterance runs the SAME
  `engine.userTurn` path as a typed turn: same turn-keyed idempotency, same
  approval-gated actions, same honesty rules. Audio events change capture,
  never authority.
- **Fail-closed and explained.** Oversized audio → `audio_too_large`;
  provider failure → `stt_failed`; STT off → `stt_disabled`; empty
  transcript → `audio.transcript` with empty text (the widget says "no te
  he oído"). Silence is never an outcome, on brand with ADR-018.

## Consequences

- The mic works wherever `MediaRecorder` does (all evergreen browsers),
  independent of Google's recognizer; local `SpeechRecognition` remains
  only as the no-gateway-STT fallback.
- Push-to-talk single-utterance REST transcription is deliberately chosen
  over the OpenAI **Realtime** WebSocket API for this phase: Realtime
  requires raw PCM streaming (AudioWorklet capture) and brings VAD/barge-in
  semantics that belong to the media-server phase. The seam is ready: a
  Realtime adapter is another `TranscriptionPort`/brain implementation
  behind the same events, and the same `STT_API_KEY` works for both.
- Per-utterance provider cost is accepted; the size cap bounds it.
- Out of scope: streaming/partial transcripts, barge-in, speaker
  diarization, server-side TTS (the avatar phase will own voice output).
