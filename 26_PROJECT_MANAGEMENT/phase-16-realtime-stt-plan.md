---
project: AURION
document: Phase 16 Server-Side STT Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
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

- [x] With `STT_MODE=openai`, a recorded utterance round-trips:
      `audio.utterance` → `audio.transcript` → `turn.agent`, with
      turn-keyed idempotency and approval-gated actions unchanged.
- [x] `STT_API_KEY` appears in gateway config only; contract tests prove
      the widget bundle and source contain no provider key or endpoint.
- [x] Every failure mode (`stt_disabled`, `audio_too_large`, `stt_failed`,
      empty transcript, mic permission denied) shows a specific message.
- [x] Runtime dependency sets unchanged (`ws` only on the gateway, zero on
      the widget); all suites green in CI with 0 vulnerabilities.

## Out of scope

- OpenAI Realtime WebSocket streaming (PCM/AudioWorklet, VAD, barge-in) —
  media-server phase; the port is the seam.
- Server-side TTS and the HeyGen avatar — next phase, on top of working
  voice input.
- Per-tenant STT configuration.

## Closure evidence

Local verification passed on branch `phase-16/realtime-stt` (2026-06-11):

- [x] `npm test` passed: **244** Python contract tests (13 new in
      `tests/project/test_phase16_realtime_stt.py`).
- [x] Gateway Vitest suite passed: **31** tests across 4 files, 11 of
      them in the new `test/stt.spec.ts` (config fail-closed, protocol
      parsing, transcriber against mocked fetch, WS audio flow).
- [x] Widget Vitest suite passed: **14** tests (recorder result
      handling, `stt_enabled` gating, transcript echo).

Remote verification on PR #30: the first CI round failed `secret-scan` —
gitleaks (`generic-api-key`, entropy > 3.5) flagged the two STT test
fixture keys. Because gitleaks scans full history, the fix replaced the
fixtures with deliberately low-entropy values (`sk-testtesttest`) by
amending the feature commit (`6b7c734` → `8ee6c81`) and force-pushing,
leaving no flagged blob reachable. All seven checks green on head
`8ee6c81` (2026-06-11).

Merge evidence: PR #30 squash-merged into `main` as `4a41c7f` on
2026-06-11.

Next: server-side TTS and the HeyGen avatar on top of working voice
input; OpenAI Realtime streaming stays behind the `TranscriptionPort`
seam for a future media-server phase.
