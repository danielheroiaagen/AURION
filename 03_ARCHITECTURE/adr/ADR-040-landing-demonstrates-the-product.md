---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-13
related: ADR-031, ADR-038, ADR-039
---

# ADR-040 — The landing demonstrates the product

<!-- landing-demonstrates: feature tag for automated search (Phase-31). -->

## Decision

The AURION public landing page must demonstrate real product capabilities
instead of promising them. Every interactive element or audio sample is
explicitly labeled as a demonstration. No invented social proof (fake
testimonials, fabricated company logos, or unverified statistics) may appear.

Concretely:

- A live, embeddable voice widget (the same widget that powers production
  calls) is offered directly in the hero. It loads lazily — only after the
  visitor clicks — so no WebSocket is opened on page load.
- A pre-recorded audio demo (generated with the same TTS voice the product
  uses in production, `alloy`) plays back a realistic support call.
- The audio sample and the live widget are both labeled as demonstrations.
- The existing demo-request form and WhatsApp path (ADR-038) remain as the
  primary human-to-human lead capture channel.

## Context

An external conversion audit (CEO-style, June 2026) gave the landing a
4/10 conversion score and a 5/10 trust score. The auditor's main finding:
the page promises capabilities that already exist in production but provides
no evidence of them. Visitors cannot verify the claim "voz natural en
español" without hearing it, and cannot experience "agenda citas" without
interacting with the bot.

AURION already has:
- A deployed voice gateway answering real Twilio calls.
- A zero-dependency browser widget (Phase 14/15, ADR-024) that connects to
  the gateway over WebSocket.
- Server-side STT (Phase 16) and TTS (Phase 17) producing natural-sounding
  Spanish speech.
- A human-approval panel (ADR-013) that is the product's core safety claim.

The landing can demonstrate all of these today without new infrastructure.
This ADR mandates that it does so — and that all examples are explicitly
labeled as demonstrations so there is no ambiguity between a live demo
and a production customer interaction.

## Consequences

- The hero section is redesigned (Phase 31, U1) to lead with proof:
  an audio clip and a live widget call-to-action before the request form.
- The widget is embedded lazily from its existing Vite build artifact
  (`apps/widget/dist/assets/`), copied to `apps/landing/assets/`.
  No new runtime npm dependencies are added to the landing.
- A pre-recorded audio file (`apps/landing/assets/demo-call.mp3`) is
  generated once using `tools/demo-audio/generate.mjs` and committed.
  Regeneration is documented in a comment next to the asset.
- The demo tenant client key is intentionally NOT committed to the repo.
  The `data-client-key` attribute is set to a placeholder
  `[PENDIENTE: clave de demo]` which the operator fills at deploy time.
  The widget degrades gracefully if the key is a placeholder or the
  connection fails.
- Future landing units (U2–U9) will add approval-panel visuals, sector
  use cases, comparison tables, pricing, and SEO pages, all following the
  same "show, don't promise" principle.

## Out of scope

- Outbound "AURION te llama" calling — own future phase.
- Cal.com self-hosted booking widget — own unit (U6 or later).
- Real published prices — pending owner decision.
- A/B testing infrastructure — deliberate omission (GDPR, complexity).
