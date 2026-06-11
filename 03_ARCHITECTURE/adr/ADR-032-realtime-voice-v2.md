---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-022, ADR-026, ADR-027
---

# ADR-032 — Realtime voice v2: latency as a product feature

## Decision

Four measures, all measured against the production line before shipping:

- **Brain latency is governed by MODEL CHOICE, not reasoning_effort.**
  With function tools (which the brain ALWAYS sends) gpt-5.4/5.5 reject
  `reasoning_effort` on `/v1/chat/completions` (400) — the lever shipped
  in #42 was dead on arrival and is REMOVED. Measured with the real
  payload (tools + history): `gpt-5.4-mini` ≈ 0.9 s vs `gpt-5.5` ≈ 4 s,
  with correct tool calls, follow-up questions and Spanish under mixed
  input. Production runs `LLM_MODEL=gpt-5.4-mini`.
- **Streaming TTS on the phone** (`SpeechSynthesisPort.synthesizeStream`,
  optional method; OpenAI `pcm` only): the bridge transcodes and ships
  μ-law frames as PCM chunks arrive, with sample-alignment carry between
  chunks — the caller hears the first word while the rest renders. HeyGen
  (MP3) keeps the buffered path.
- **Streaming-first transcription**: `TELEPHONY_STT_MODEL` (default:
  `STT_MODEL`) lets the call use `gpt-realtime-whisper` — OpenAI's
  May-2026 streaming STT — WITHOUT touching the widget's REST path. That
  model takes no server VAD, so the adapter segments utterances itself
  from μ-law energy (mean |amplitude| ≥ 350 = speech; commit after the
  configured silence with ≥120 ms of speech) and keeps barge-in via its
  own speech-onset detection; `delay: "low"` tightens the final
  transcript.
- **Echo guard**: the line transcribed OUR OWN greeting as caller speech
  on a live call (a ghost turn). Anything the agent just said —
  accent/punctuation-insensitive — never becomes a turn, and the drop is
  logged.

## Context

Daniel's live calls produced the data: `brain=1.6–5.2 s`, `tts=1.2–3.6 s`
per turn (the per-turn timing log shipped in #42), one ghost turn from
greeting echo, and one gibberish transcription. He asked for faster turns
and a transcription model worthy of mid-2026.

## Consequences

- Expected turn ≈ 0.5 s VAD + ~0.3 s transcript + ~0.9 s brain + ~0.4 s
  first audio — roughly 2 s to first spoken word, from ~5–7 s.
- The energy-VAD threshold is a constant calibrated on telephone speech;
  if a noisy line ever mis-segments, it becomes config — not before
  (YAGNI).
- `reasoning_effort` may return for `/v1/responses` if the brain ever
  migrates endpoints; that is its own ADR.
- Out of scope: speech-to-speech models (bypass the approval-gated
  brain, ADR-027), partial-transcript turn-taking, TTS caching.
