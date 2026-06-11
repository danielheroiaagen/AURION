---
project: AURION
document: Phase 17 Server-Side TTS Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
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

- [ ] With `TTS_MODE=openai`, every agent reply round-trips:
      `turn.user`/`audio.utterance` → `turn.agent` (text first) →
      `audio.agent` (voice after); a synthesis failure delivers the text
      plus `tts_failed`, never silence.
- [ ] `TTS_API_KEY` appears in gateway config only; contract tests prove
      the widget source contains no provider key or endpoint.
- [ ] With gateway TTS active the widget does NOT also speak locally (no
      double voice); with it off, local `speechSynthesis` still works.
- [ ] Runtime dependency sets unchanged (`ws` only on the gateway, zero on
      the widget); all suites green in CI with 0 vulnerabilities.

## Out of scope

- HeyGen streaming avatar — next phase, on top of this seam (needs a
  WebRTC/LiveKit media channel and its own ADR).
- Streaming/chunked synthesis, barge-in — media-server phase.
- Per-tenant voice configuration; reply audio caching.

## Closure evidence

To be completed at phase close.
