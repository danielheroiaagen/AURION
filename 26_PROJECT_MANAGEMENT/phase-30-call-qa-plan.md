---
project: AURION
document: Phase 30 Call QA Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: planned
created_at: 2026-06-12
related: ADR-013, ADR-018, ADR-023, ADR-038
---

# Phase 30 — Call QA: measure the quality of the audio we ship

Audio Pro (Phase 29) makes the line sound professional; Call QA makes that
quality **measurable and auditable** — the layer that turns AURION from "a
voice agent that works" into a service an enterprise buyer trusts. It also
closes the loop on Phase 29: you cannot tune turn-taking or a voice you
cannot review.

## Work units (each its own ADR + increment)

1. **Call recording & transcript review.** A reviewable record per call:
   the transcript already exists (sessions carry an encrypted summary,
   ADR-013); add per-turn transcript retention and, where consented, audio
   retention — under the SAME RLS tenancy and column-encryption posture,
   with an explicit GDPR retention window (ties to `13_COMPLIANCE`).
2. **Conversation scoring / eval.** Automated per-call scoring (resolution,
   language fidelity, latency, escalation correctness) building on the
   per-turn timing logs (ADR-032) and the eval/simulation docs in
   `30_AI_ENGINEERING`. Surfaced as a tenant-scoped QA read.
3. **QA dashboard surface.** Per-tenant call analytics: outcomes, lead
   capture rate (ADR-037), latency distribution, flagged calls for human
   review — on the existing dashboard stack (ADR-031).

## Acceptance criteria

- [ ] Every call has a reviewable, tenant-isolated record honoring its
      consent and retention window.
- [ ] Each call carries an automated quality score with an auditable
      breakdown.
- [ ] A tenant admin can review outcomes and flag calls from the dashboard.

## Out of scope

- Real-time supervisor barge-in / live monitoring (later phase).
- Speech analytics beyond transcript + timing (sentiment, etc.).
- Billing/metering on top of call volume (separate commercial phase).

## Dependencies

- Phase 29 Audio Pro for the quality signals worth measuring.
- ADR-038 (text turn preserved) — scoring reads the text record, not S2S.
