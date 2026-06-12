---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-12
related: ADR-013, ADR-018, ADR-026, ADR-027, ADR-032
---

# ADR-038 — Speech-to-speech: when the pipeline stays, when the model takes over

## Decision

AURION keeps the **STT → brain → TTS pipeline** (ADR-027/ADR-032) as the
spine of the answering tier, and does **not** adopt a native
speech-to-speech (S2S) model for it. The reason is not latency — it is
authority. The whole product rests on two invariants that only exist
because a **text turn** sits in the middle of every exchange:

- **Text is the source of truth (ADR-026).** `turn.agent` is delivered,
  logged and summarized as text; audio is an enhancement that can fail
  without losing the answer. An S2S model emits audio first and text
  second (or never), inverting this.
- **Actions are approval-gated (ADR-013/ADR-018).** A tool intent becomes
  a REQUESTED action keyed to a transcribed turn; humans execute on the
  dashboard. A model that decides and speaks in one breath has no seam to
  gate, audit, or replay idempotently.

So S2S is **scoped, not rejected**. It is admitted only as a future
**premium conversational tier** — a separate channel with its own ADR —
where the brain still owns tool authority via the Realtime API's
function-calling (the model speaks, but a tool call still leaves the audio
loop and lands on the SAME approval-gated `requestAction` path before any
side effect). Until that ADR exists and that seam is proven, the
answering tier that takes paid traffic runs the pipeline.

What we ship NOW to make the pipeline sound professional is **Fase 29 —
Audio Pro**, all of it inside the existing seam, none of it requiring S2S:

1. **Backchannel on slow turns** (this ADR, shipped here). A slow brain
   leaves dead air; the bridge speaks a short, language-matched filler
   ("Un momento, lo reviso.") if the answer is not ready within a window,
   then the real reply follows. `TELEPHONY_BACKCHANNEL_MS` (default 1500,
   `0` disables). The reply text is still the source of truth and always
   follows the filler — the filler is never an answer and never an action.
2. **Brand voice & persona consistency** — one named, tuned voice per
   tenant tier (own ADR amends ADR-026/ADR-029 voice selection).
3. **Semantic end-of-turn** — replace pure energy-VAD segmentation with
   meaning-aware turn closure so the agent neither cuts the caller off nor
   leaves a gap (own ADR amends ADR-032 VAD).
4. **Barge-in v2** — echo-aware interruption; the line stops cleanly and
   does not transcribe the tail of its own voice as a turn.

## Context

Daniel asked to make the audio "más profesional" before opening ads
traffic, and explicitly asked for the speech-to-speech decision as the
base of that work. The naive read is "switch to a realtime S2S model and
get human prosody for free". The data from ADR-032 already put the
pipeline at ~2 s to first spoken word with correct tool calls; the gap to
"professional" is not raw latency, it is dead air, turn-taking and a
recognizable voice — all addressable without surrendering the text turn
that the approval model and the audit trail depend on.

## Consequences

- The answering tier stays auditable and gated; "more natural" is bought
  with Audio Pro, not by removing the text turn.
- Backchannel adds at most one short synthesis on genuinely slow turns;
  fast turns (gpt-5.4-mini ≈ 0.9 s, ADR-032) never trigger it, so the
  default is safe and existing call tests are unaffected.
- The backchannel echo edge: a filler spoken just before the reply is not
  held by the single-line echo guard (ADR-032). It is short and rarely
  re-transcribed; if a live call ever turns a filler into a ghost turn,
  the guard grows a small recent-line window — not before (YAGNI).
- S2S is a deferred, ADR-gated premium channel, never a silent swap of the
  answering tier.
- Out of scope here: the S2S premium-tier ADR, brand-voice selection,
  semantic end-of-turn, barge-in v2 (each its own Fase 29 increment) and
  all of Fase 30 call QA.
