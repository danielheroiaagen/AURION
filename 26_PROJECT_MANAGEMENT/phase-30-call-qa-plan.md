---
project: AURION
document: Phase 30 Call QA Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
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

1. **Call recording & transcript review.**
   - **Per-turn transcript retention (shipped, ADR-039).** New
     `voice_session_turns` table: tenant-scoped (RLS), `text` AES-256-GCM
     encrypted at the app layer, append-only (the audit guard). The gateway
     flushes the transcript in one best-effort batch at close;
     `POST /voice-sessions/:id/turns` (write, `conversation:write`,
     idempotent) and `GET /voice-sessions/:id/turns` (QA read,
     `conversation:review`).
   - **Remaining (planned):** consented audio retention, and an explicit
     GDPR retention window (auto-expiry sweep) — crypto-shredding (ADR-015)
     is the erasure lever until then (ties to `13_COMPLIANCE`).
2. **Conversation scoring / eval.** Automated per-call scoring (resolution,
   language fidelity, latency, escalation correctness) building on the
   per-turn timing logs (ADR-032) and the eval/simulation docs in
   `30_AI_ENGINEERING`. Surfaced as a tenant-scoped QA read.
3. **QA dashboard surface.** Per-tenant call analytics: outcomes, lead
   capture rate (ADR-037), latency distribution, flagged calls for human
   review — on the existing dashboard stack (ADR-031).

## Acceptance criteria

- [x] Every call has a reviewable, tenant-isolated, encrypted, append-only
      per-turn transcript (unit 1, ADR-039); consent/retention-window
      enforcement still pending.
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
