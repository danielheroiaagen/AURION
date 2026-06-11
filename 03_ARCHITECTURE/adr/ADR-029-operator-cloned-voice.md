---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-026, ADR-027
---

# ADR-029 — The operator's cloned voice on every channel

## Decision

The agent can speak with **Daniel's own cloned voice** (HeyGen voice id,
verified live against his account) through a second `SpeechSynthesisPort`
adapter — same seam, new provider:

- **`TTS_MODE` gains `heygen`.** `HeyGenSpeechSynthesizer` calls
  `POST /v3/voices/speech` (`text`, `voice_id` from `TTS_VOICE`) and
  downloads the returned `audio_url` — two fetches, one timeout budget,
  zero new npm dependencies. Output is **MP3** (`audio/mpeg`); HeyGen
  offers no format/sample-rate options.
- **Widget: nothing changes.** `audio.agent` already carries
  `mime_type`; browsers play MP3 natively. The phase 17 contract was
  provider-agnostic by design.
- **Telephony: ffmpeg decodes in the container.** The phone wire needs
  μ-law 8 kHz and an MP3 decoder in pure JS is not a serious option. The
  gateway image adds the `ffmpeg` **system binary** (Alpine package);
  the bridge pipes MP3 through
  `ffmpeg -i pipe:0 -f mulaw -ar 8000 -ac 1 pipe:1` per reply.
  The npm dependency set stays `ws`-only — the ADR-018 rule was about
  supply-chain surface, and a distro binary in our own image is a
  different (and inspectable) trust grant.
- **Fail-closed, as always:** `TTS_MODE=heygen` requires `TTS_API_KEY`
  (the HeyGen key) and `TTS_VOICE` (the voice id). When telephony is on
  and the synthesizer produces non-PCM audio, the gateway verifies at
  boot that `ffmpeg` is executable and refuses to start otherwise — a
  phone gateway that cannot voice its replies does not answer.

## Context

Phase 17 chose OpenAI TTS (provider voices). Daniel wants callers to
hear HIS voice; his clone lives in HeyGen ("daniel Gonzalez Junco",
verified via `/v2/voices`). HeyGen's TTS endpoint works with that clone
(tested live: 7.4 s of Spanish audio) but returns MP3 only, which the
browser loves and the phone cannot use raw — hence the two-channel
treatment above.

## Consequences

- One `.env` change (`TTS_MODE=heygen`, `TTS_VOICE=<id>`) puts Daniel's
  voice on the widget and the phone simultaneously; switching back to
  OpenAI is the same one change. Per-tenant voices remain out of scope.
- HeyGen synthesis is slower than OpenAI (~3–5 s per reply observed) and
  is billed in HeyGen credits; acceptable for v1, and the port seam
  means a faster cloning provider (e.g. ElevenLabs, native μ-law output)
  is just another adapter if latency hurts.
- The gateway image grows by the ffmpeg package; CI builds it, the
  contract tests keep proving npm deps stay `ws`-only.
- Out of scope: streaming synthesis, emotion/SSML control, the HeyGen
  avatar (still its own phase), voice consent/disclosure copy (go-live
  legal follow-up).
