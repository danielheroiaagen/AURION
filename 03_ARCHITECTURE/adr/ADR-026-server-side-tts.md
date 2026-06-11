---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-018, ADR-022, ADR-024, ADR-025
---

# ADR-026 — Server-side text-to-speech behind a gateway port

## Decision

The agent's replies are voiced **server-side, by the voice gateway**,
through a new driven port — the mirror of ADR-025 for the output
direction:

- **`SpeechSynthesisPort`** — `synthesize(text) → { audio, mimeType }`.
  First adapter: `OpenAiSpeechSynthesizer`, calling the OpenAI
  `POST /v1/audio/speech` endpoint with plain `fetch` + JSON — **no SDK**,
  the gateway's runtime dependency set stays `ws` only (ADR-018).
- **One additive WS event**: server → client `audio.agent`
  `{ audio: base64, mime_type }` — the spoken form of the last
  `turn.agent`, sent right after it. The TEXT event is the source of truth
  and is always delivered first; audio is an enhancement.
- **`session.started` gains `tts_enabled: boolean`** so the widget knows
  honestly whether replies will arrive voiced. When TTS is off the widget
  falls back to its existing local `speechSynthesis` (ADR-024); when TTS is
  on, local synthesis is suppressed so the voice never doubles.
- **Config, fail-closed** (same pattern as `STT_MODE`): `TTS_MODE` is
  `off` (default) or `openai`; `openai` requires `TTS_API_KEY` and refuses
  to boot without it. `TTS_MODEL` defaults to `gpt-4o-mini-tts`,
  `TTS_VOICE` to `alloy`, `TTS_API_URL` to `https://api.openai.com/v1`;
  timeout and a per-reply text cap (`TTS_MAX_TEXT_CHARS`) are configurable.

## Context

Phase 16 (ADR-025) moved speech INPUT to infrastructure we control; voice
OUTPUT still rides the browser's `speechSynthesis` — robotic, inconsistent
across platforms, silent on some. With STT server-side, the natural seam
for output is the same gateway that already holds the provider key: the
widget records, the gateway listens and now also speaks.

The HeyGen avatar (Daniel's key and avatar id are ready) was considered
for this phase and **deliberately deferred**: HeyGen's Streaming Avatar
API requires the LiveKit client SDK and a WebRTC media channel in the
browser, which breaks the widget's zero-dependency rule (ADR-024) and is a
media-server concern. This ADR creates the voice-output seam the avatar
phase will ride: an avatar adapter is another voice-output channel behind
the same `turn.agent` text, with its own ADR for the media transport.

## Architectural rules

- **The provider key never reaches the browser.** `TTS_API_KEY` lives only
  in the gateway's environment; the widget receives finished audio bytes
  over the WebSocket it already has.
- **Text is the source of truth.** `turn.agent` is sent BEFORE synthesis
  runs; a TTS failure raises stable error code `tts_failed` and costs the
  voice, never the answer. The transcript on screen is always complete.
- **Same authority.** Voicing a reply changes presentation, never
  authority: no new client→server events, no new action paths, the
  approval gate (ADR-007/ADR-013) is untouched.
- **Fail-closed and explained.** Unknown `TTS_MODE` or a missing key
  refuses boot; provider failure → `tts_failed`; playback failure in the
  browser (decode, autoplay policy) → a specific on-screen message
  (phase 15 rule). Silence is never an outcome.

## Consequences

- The agent's voice works wherever HTML audio does (all evergreen
  browsers) and sounds the same everywhere — the provider voice, not the
  platform's; local `speechSynthesis` remains only as the no-gateway-TTS
  fallback.
- Per-reply provider cost is accepted; `TTS_MAX_TEXT_CHARS` bounds it the
  way `STT_MAX_AUDIO_BYTES` bounds transcription.
- Single-shot MP3 per reply is deliberately chosen over streaming TTS:
  chunked/streamed playback and barge-in belong to the media-server phase;
  the port is the seam, and the same `TTS_API_KEY` works for both.
- Out of scope: the HeyGen avatar (next phase, on this seam), streaming
  synthesis, per-tenant voice configuration, caching of repeated replies.
