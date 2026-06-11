---
project: AURION
document: Phase 20 Operator Voice Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-11
related: ADR-026, ADR-027, ADR-029
---

# Phase 20 — The operator's cloned voice on every channel

Daniel's request: callers hear HIS voice. His clone lives in HeyGen
("daniel Gonzalez Junco", id verified live against `/v2/voices`; TTS
tested live against `/v3/voices/speech` — 7.4 s of Spanish audio). HeyGen
returns MP3 only, so the widget plays it natively and the phone decodes
it with the ffmpeg system binary in the gateway image (ADR-029).

## Work units

1. `TTS_MODE=heygen`: `HeyGenSpeechSynthesizer` (two fetches under one
   timeout — speech request, then `audio_url` download; zero new npm
   deps), fail-closed config (`TTS_API_KEY` + `TTS_VOICE` required,
   empty `TTS_API_URL` treated as unset).
2. Telephony decode path: `mp3-ulaw.ts` (`ffmpegAvailable` boot check +
   `mp3ToUlaw8k` pipe through `ffmpeg -f mulaw -ar 8000 -ac 1`), bridge
   accepts MP3 synthesis when a transcoder is injected, gateway image
   adds the ffmpeg Alpine package.
3. Plumbing: compose passes `TTS_API_URL`; `.env.example` documents
   heygen mode; CHANGELOG.
4. Tests: heygen config fail-closed, synthesizer against mocked fetch
   (both hops, every failure shape), transcoder plumbing against a stand-
   in child process, bridge MP3 call flow over real sockets, and
   contract tests `tests/project/test_phase20_operator_voice.py`.

## Acceptance criteria

- [ ] With `TTS_MODE=heygen` + `TTS_VOICE=<id>`, the widget's
      `audio.agent` carries the cloned voice (MP3) and a phone call
      voices replies through the ffmpeg decode — same approval-gated
      engine, no protocol changes.
- [ ] heygen mode refuses to boot without key/voice id; telephony with
      heygen TTS refuses to boot without ffmpeg in the image.
- [ ] npm runtime dependency set unchanged (`ws` only); all suites green
      in CI.

## Out of scope

- The HeyGen avatar (own phase), streaming synthesis, per-tenant voices,
  voice consent/disclosure copy.

## Closure evidence

To be completed at phase close.
