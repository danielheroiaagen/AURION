---
project: AURION
document: Phase 22 Futurist Design Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-11
related: ADR-017, ADR-024, ADR-031
---

# Phase 22 — Design v2 "deep ocean futurist" (Tailwind + shadcn)

Daniel's brief: deep-ocean evolved into a futurist AI look — "que se
note que usamos IA" — with Linear and Notion influences, built on
Tailwind + shadcn (ADR-031).

## Work units

1. Stack: Tailwind v4 via @tailwindcss/vite; shadcn-style components
   copied in and themed (Button, Card, Badge, Input/Label/Textarea),
   cn() helper, lucide icons.
2. Tokens v2 in `@theme`: abyssal palette, cyan→violet brand gradient,
   aurora + circuitry-grid body, glass surfaces, glow shadows; shadcn
   variable bridge; tabular numerals.
3. Reskin without breakage: every legacy class contract restyled in
   `@layer components`; shell/nav (icons, live indicator), login (glass
   hero) and overview (gradient KPIs, glowing bars) converted to
   components.
4. Widget: same v2 tokens hand-written in its zero-dep stylesheet
   (ADR-024 boundary intact, bundle still ~10 kB).
5. Docs: ADR-031, design-tokens.md v2, CHANGELOG; contract tests
   `tests/project/test_phase22_design.py`.

## Acceptance criteria

- [ ] Dashboard builds with Tailwind; all dashboard logic tests and
      typecheck green; widget bundle unchanged in dependency count.
- [ ] One visual language across dashboard and widget (tokens v2);
      legacy pages look correct without conversion.
- [ ] npm audit clean with the new dev dependencies; all CI checks green.

## Out of scope

- Light mode, per-tenant theming, charting libraries, converting every
  page to shadcn components (incremental, as pages get touched).

## Closure evidence

To be completed at phase close.
