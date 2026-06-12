---
project: AURION
document: Phase 31 Landing Conversion Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-13
related: ADR-040
---

# Phase 31 — Landing conversion

## Goal

Transform the AURION landing from a promise page (4/10 conversion, 5/10
trust) into a demonstration page that lets visitors hear, interact with,
and understand the product before booking a meeting.

## Work units

### U1 — Live demo hero ✅ implemented

Replace the hero copy and CTAs with proof-led content:
- New H1 and subtitle that name the use case explicitly.
- "Habla con AURION ahora" CTA that opens the embedded voice widget
  (lazy load, no WS on page load).
- "Escucha a AURION en acción" audio block with the pre-recorded demo call
  and a collapsible transcript.
- Voice widget embedded from the existing apps/widget build (no new deps).
- ADR-040 documents the "demonstrate, don't promise" mandate.
- Generation script `tools/demo-audio/generate.mjs` for reproducing the
  audio asset.

### U2 — Approval panel visual ✅ implemented

Pure HTML/CSS mockup card (zero JS) of the real dashboard approval panel,
placed after the "Cómo funciona" section and before the demo-request form.
Mirrors the same Marta López call from the U1 audio demo (continuity).
Decorative Aprobar/Rechazar elements are `<span>` with `aria-hidden="true"`;
no Editar capability shown (honesty rule). Caption and footer note included.

### U3 — Sector use cases ⏳ pending

Three collapsible or tabbed scenario cards (clínica dental, taller mecánico,
asesoría) each with a realistic mini-dialogue and the resulting action that
appears in the approval panel. Replaces generic "step" descriptions.

### U4 — Operational safety section ⏳ pending

Dedicated section listing exactly what data is stored and what is not
(audio not stored, transcription text stored encrypted, session metadata
retained per retention policy). Linked from the privacy notice. Builds
trust for GDPR-cautious prospects.

### U5 — Comparison table and FAQs ⏳ pending

"AURION vs. contestador" and "AURION vs. recepcionista humana" comparison
table (2 columns). FAQs addressing the top objections surfaced in sales
calls: number change, approval flow, connector setup, pricing, data.

### U6 — Pricing section ⏳ pending

Real, published pricing tiers (pending owner decision on amounts).
Until then, a "Precio bajo consulta — reserva una demo" placeholder with
an honest explanation of why pricing is customized.

### U7 — GDPR precision ⏳ pending

Audit and tighten the cookie consent copy, privacy notice links, and the
audio demo disclosure to match the exact data processing described in
ADR-011 and ADR-034. Ensure the "audio no se almacena" claim is verified
against the production config.

### U8 — SEO pages and schema ⏳ pending

Add `<script type="application/ld+json">` Organization and FAQPage schema
to the landing. Create one sector-specific landing variant (e.g.
`/clinicas.html`) to capture long-tail search. Extend `sitemap.xml`.

### U9 — Performance and accessibility ⏳ pending

Audit Lighthouse scores (target: Performance ≥ 90, Accessibility ≥ 95).
Address any new render-blocking resources introduced in U1–U8. Verify
the audio player and widget are keyboard-navigable and screen-reader
friendly (WCAG 2.1 AA minimum).

## Acceptance criteria (U1)

- [x] ADR-040 committed with "demonstrates" and "labeled as demonstrations" markers.
- [x] Phase-31 plan committed with all nine units listed.
- [x] Landing H1 contains the new copy verbatim.
- [x] `id="cta-live-demo"` present in the landing.
- [x] HTML5 `<audio>` element references `assets/demo-call.mp3`.
- [x] Collapsible `<details>` with "Ver transcripción" present.
- [x] Disclosure "Hablarás con una IA" present.
- [x] Widget container has `data-gateway-url` and `data-client-key` attributes.
- [x] `tools/demo-audio/generate.mjs` exists with alloy, nova, OPENAI_API_KEY markers.
- [x] `apps/landing/assets/demo-call.mp3` exists, > 100 KB, < 2 MB, valid MP3 header.
- [x] Phase-29 landing markers still pass lint gate (`id="demo-form"`, `data-lead-form`, `wa.me`).
- [x] `npm run lint` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run test:project` passes.
