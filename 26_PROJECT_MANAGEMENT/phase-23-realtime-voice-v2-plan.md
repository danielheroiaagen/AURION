---
project: AURION
document: Phase 23 Realtime Voice v2 Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-11
related: ADR-022, ADR-027, ADR-032
---

# Phase 23 — Realtime voice v2: ~2 s to the first spoken word

Daniel's brief after live calls: faster turns and a transcription model
worthy of mid-2026. The per-turn timing logs gave the data; ADR-032 the
decisions.

## Work units

1. Brain: remove the dead `reasoning_effort` lever (400 with tools);
   production model switched to `gpt-5.4-mini` (measured ≈ 0.9 s with the
   real payload vs ≈ 4 s on gpt-5.5).
2. Streaming TTS: optional `synthesizeStream` on the port, OpenAI pcm
   implementation, bridge ships μ-law frames as chunks arrive
   (sample-alignment carry), buffered fallback for HeyGen/MP3.
3. Streaming STT: `TELEPHONY_STT_MODEL` selects `gpt-realtime-whisper`
   for calls only; adapter-side energy VAD (no server turn_detection),
   manual commits, `delay: low`, barge-in preserved.
4. Echo guard: the agent's own just-spoken words never become a turn.
5. Plumbing: `.env.example`, compose `TELEPHONY_STT_MODEL`, CHANGELOG;
   contract tests `tests/project/test_phase23_realtime_voice.py`.

## Acceptance criteria

- [ ] A phone turn starts speaking in ~2 s (timing logs as evidence).
- [ ] gpt-realtime-whisper transcribes the call with adapter VAD; the
      widget REST path is untouched.
- [ ] Echoed agent speech is dropped and logged, never a turn.
- [ ] All suites green; runtime deps unchanged (`ws` only).

## Out of scope

- Speech-to-speech conversation models (ADR-027 boundary), partial-
  transcript turn taking, TTS caching, VAD threshold config (constant
  until proven insufficient).

## Closure evidence

To be completed at phase close.
