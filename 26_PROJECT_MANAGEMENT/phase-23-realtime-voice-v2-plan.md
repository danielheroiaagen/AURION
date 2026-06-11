---
project: AURION
document: Phase 23 Realtime Voice v2 Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
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

- [x] A phone turn starts speaking in ~2 s (timing logs as evidence).
- [x] gpt-realtime-whisper transcribes the call with adapter VAD; the
      widget REST path is untouched.
- [x] Echoed agent speech is dropped and logged, never a turn.
- [x] All suites green; runtime deps unchanged (`ws` only).

## Out of scope

- Speech-to-speech conversation models (ADR-027 boundary), partial-
  transcript turn taking, TTS caching, VAD threshold config (constant
  until proven insufficient).

## Closure evidence

- PR #45 squash-merged into `main` as `bb1113b` (2026-06-11), all checks
  green; 307 contract tests (7 new), 74 gateway Vitest tests (3 new).
- Live contract checks BEFORE the call: gpt-realtime-whisper session
  accepted from the production container (`session.updated`); two
  simulated Twilio calls against the public `/twilio` (greeting media at
  1.4 s; loud-audio burst exercised VAD onset → barge-in `clear` →
  manual commit → whisper answered an honest empty transcript, no ghost
  turn).
- Daniel's two silent calls (14:02/14:30 UTC) were diagnosed WITH data
  (gateway logs empty + Twilio call records completed + signed /twiml
  200 + healthy simulations): they hit container-recreation windows
  during deploys. Operating rule adopted: no deploys while the operator
  is testing the line.
- LIVE verification call (Daniel, 14:38 UTC, watched turn-by-turn via a
  log monitor): 7 turns, brain 757–1219 ms (avg ≈ 950 ms vs 1.6–5.2 s
  before), faithful Spanish transcriptions including a long compound
  sentence, language held the whole call, and the loop closed end to
  end — session `tw-CA48061b…` recorded `completed` with a Spanish
  transcript summary and `ticket.create` registered awaiting approval:
  "Solicitud de consultoría RIA para automatizar atención al cliente en
  clínicas dentales e inmobiliarias".
