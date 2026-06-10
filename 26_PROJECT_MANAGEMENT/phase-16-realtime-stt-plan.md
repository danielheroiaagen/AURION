---
project: AURION
document: Phase 16 Server-Side STT Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-11
related: ADR-018, ADR-024, ADR-025
---

# Phase 16 — Server-side STT: the mic that actually works

Phase 15 made mic failures visible; this phase removes their root cause.
Chrome's browser recognizer (an online Google service) is replaced as the
primary path by gateway-side transcription through OpenAI (ADR-025), using
Daniel's OpenAI API key — configured only on the gateway, never shipped to
the browser.

## Work units

1. Contract: `audio.utterance` / `audio.transcript` events and the
   `stt_enabled` flag on `session.started` added to
   `27_VOICE_IVR/websocket-event-contracts.md`; new stable error codes
   `stt_disabled`, `audio_too_large`, `stt_failed`.
2. Gateway: `TranscriptionPort` + `OpenAiTranscriber` (fetch + native
   FormData, zero new runtime deps), `STT_MODE` config (off|openai,
   fail-closed), `audio.utterance` handling in the WS server feeding the
   SAME `engine.userTurn` path as typed turns.
3. Widget: push-to-talk recording with `getUserMedia` + `MediaRecorder`
   (local, no Google service), base64 utterance over the existing WS,
   transcript echo rendered as the caller line; browser `SpeechRecognition`
   demoted to fallback when the gateway reports `stt_enabled: false`;
   every new failure mode has a specific on-screen message (phase 15 rule).
4. Plumbing: compose + `.env.example` expose `STT_*`; CHANGELOG.
5. Tests: gateway specs (config fail-closed, protocol parsing, transcriber
   against a mocked fetch, ws audio flow), widget specs (recorder result
   handling, stt_enabled gating, transcript echo), and contract tests
   `tests/project/test_phase16_realtime_stt.py`.

## Acceptance criteria

- [ ] With `STT_MODE=openai`, a recorded utterance round-trips:
      `audio.utterance` → `audio.transcript` → `turn.agent`, with
      turn-keyed idempotency and approval-gated actions unchanged.
- [ ] `STT_API_KEY` appears in gateway config only; contract tests prove
      the widget bundle and source contain no provider key or endpoint.
- [ ] Every failure mode (`stt_disabled`, `audio_too_large`, `stt_failed`,
      empty transcript, mic permission denied) shows a specific message.
- [ ] Runtime dependency sets unchanged (`ws` only on the gateway, zero on
      the widget); all suites green in CI with 0 vulnerabilities.

## Out of scope

- OpenAI Realtime WebSocket streaming (PCM/AudioWorklet, VAD, barge-in) —
  media-server phase; the port is the seam.
- Server-side TTS and the HeyGen avatar — next phase, on top of working
  voice input.
- Per-tenant STT configuration.

## Closure evidence

To be completed at phase close.
