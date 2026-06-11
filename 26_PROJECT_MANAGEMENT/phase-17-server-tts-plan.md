---
project: AURION
document: Phase 17 Server-Side TTS Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-11
related: ADR-018, ADR-024, ADR-025, ADR-026
---

# Phase 17 — Server-side TTS: the agent's own voice

Phase 16 gave the gateway ears; this phase gives it a voice. The browser's
`speechSynthesis` (robotic, platform-dependent) is replaced as the primary
path by gateway-side synthesis through OpenAI (ADR-026), using the same
key discipline as STT — configured only on the gateway, never shipped to
the browser. The HeyGen avatar is explicitly deferred to the next phase
(LiveKit/WebRTC media channel — its own ADR); this phase builds the
voice-output seam it will ride.

## Work units

1. Contract: `audio.agent` event and the `tts_enabled` flag on
   `session.started` added to `27_VOICE_IVR/websocket-event-contracts.md`;
   new stable error code `tts_failed`.
2. Gateway: `SpeechSynthesisPort` + `OpenAiSpeechSynthesizer` (fetch +
   JSON, zero new runtime deps), `TTS_MODE` config (off|openai,
   fail-closed), synthesis in the SAME `runTurn` path — `turn.agent` text
   first, `audio.agent` after, `tts_failed` on provider failure.
3. Widget: `player.ts` plays the synthesized reply (base64 → Blob →
   Audio, zero deps); browser `speechSynthesis` demoted to fallback when
   the gateway reports `tts_enabled: false`; every playback failure
   (unavailable, decode, autoplay-blocked) has a specific on-screen
   message (phase 15 rule).
4. Plumbing: compose + `.env.example` expose `TTS_*`; CHANGELOG.
5. Tests: gateway specs (config fail-closed, synthesizer against a mocked
   fetch, ws turn flow with/without TTS, failure ordering), widget specs
   (playback result handling, tts_enabled gating), and contract tests
   `tests/project/test_phase17_server_tts.py`.

## Acceptance criteria

- [x] With `TTS_MODE=openai`, every agent reply round-trips:
      `turn.user`/`audio.utterance` → `turn.agent` (text first) →
      `audio.agent` (voice after); a synthesis failure delivers the text
      plus `tts_failed`, never silence.
- [x] `TTS_API_KEY` appears in gateway config only; contract tests prove
      the widget source contains no provider key or endpoint.
- [x] With gateway TTS active the widget does NOT also speak locally (no
      double voice); with it off, local `speechSynthesis` still works.
- [x] Runtime dependency sets unchanged (`ws` only on the gateway, zero on
      the widget); all suites green in CI with 0 vulnerabilities.

## Out of scope

- HeyGen streaming avatar — next phase, on top of this seam (needs a
  WebRTC/LiveKit media channel and its own ADR).
- Streaming/chunked synthesis, barge-in — media-server phase.
- Per-tenant voice configuration; reply audio caching.

## Closure evidence

Local verification passed on branch `phase-17/server-tts` (2026-06-11):

- [x] `npm test` passed: **257** Python contract tests (13 new in
      `tests/project/test_phase17_server_tts.py`).
- [x] Gateway Vitest suite passed: **39** tests across 5 files, 8 of them
      in the new `test/tts.spec.ts` (config fail-closed, synthesizer
      against mocked fetch, text-before-voice ordering, failure survival).
- [x] Widget Vitest suite passed: **20** tests (playback results,
      blob URL cleanup, tts_enabled gating, voiced-reply flow).
- [x] Typecheck clean on gateway and widget; widget bundle stays
      zero-dependency (10.59 kB / 4.25 kB gzip); gitleaks clean on full
      history (low-entropy fixtures from the start — phase 16 lesson).

Remote verification on PR #31: all seven checks green on head `5067759`
on the FIRST run (2026-06-11).

Also shipped: STT default upgraded `gpt-4o-mini-transcribe` →
`gpt-4o-transcribe` (Daniel's request; the strongest REST transcription
model — no 5.x transcribe model exists, reasoning belongs to `LLM_MODEL`).

Merge evidence: PR #31 squash-merged into `main` as `01661f6` on
2026-06-11.

Next: phase 18 — the HeyGen streaming avatar on this voice-output seam
(needs a WebRTC/LiveKit media-channel ADR and a widget-dependency
decision); OpenAI Realtime streaming remains behind the port seams.
