---
project: AURION
document: Phase 29 Audio Pro Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-12
related: ADR-026, ADR-029, ADR-032, ADR-038
---

# Phase 29 — Audio Pro: the line sounds professional before ads traffic

Daniel's brief: do not stop at "it works" — make the audio noticeably more
professional before opening ads traffic, with the speech-to-speech
decision as the base. ADR-038 made that decision (pipeline stays, S2S is a
deferred premium tier) and scoped this phase. Every unit lives inside the
existing STT → brain → TTS seam — none of it surrenders the text turn the
approval model depends on.

## Work units

1. **Backchannel on slow turns (shipped, ADR-038).** The bridge speaks a
   short, language-matched filler ("Un momento, lo reviso.") when the
   brain has not answered within `TELEPHONY_BACKCHANNEL_MS` (default 1500,
   `0` disables); the real reply text follows and stays the source of
   truth. Fast turns never trigger it.
2. **Brand voice per tenant (shipped, ADR-038).** `SpeechSynthesisPort`
   takes an optional `voice` override; each ADR-035 route carries its own
   `voice`, so every client answers in its own brand voice on one shared
   synthesizer (empty → default `TTS_VOICE`). The greeting cache is keyed by
   (voice, text). Per-tenant persona (system prompt/tone) is a later brain
   increment.
3. **Semantic end-of-turn (planned, own ADR).** Replace pure energy-VAD
   segmentation with meaning-aware turn closure so the agent neither cuts
   the caller off nor leaves a gap; amends ADR-032 VAD.
4. **Barge-in v2 (planned, own ADR).** Echo-aware interruption: the line
   stops cleanly on caller speech and never transcribes the tail of its
   own voice as a turn.

## Acceptance criteria

- [x] A genuinely slow turn fills the silence with a language-matched
      filler, then delivers the real reply; fast turns are untouched and
      every existing call test stays green.
- [x] Each tenant answers in its configured brand voice; absent → default,
      and the greeting cache never crosses voices (unit 2).
- [ ] Turn closure is meaning-aware, measured on live calls (unit 3).
- [ ] Caller interruptions never produce a ghost turn (unit 4).

## Out of scope

- The speech-to-speech premium-tier channel (deferred, ADR-038).
- TTS caching beyond the existing greeting cache (ADR-029).
- Call recording, transcript review and conversation scoring — those are
  Phase 30 (Call QA).

## Closure evidence

- Unit 1 (backchannel): see CHANGELOG `[Unreleased]` and the
  `phase 29 audio pro` commit; new gateway Vitest case
  (`telephony.spec.ts`) drives a slow brain and asserts the filler frame
  precedes the reply frame, and that a fast brain emits no filler.
