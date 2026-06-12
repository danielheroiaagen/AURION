---
project: AURION
document: Phase 29 Professional Product Polish Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: implemented
created_at: 2026-06-12
related: ADR-038
---

# Phase 29 — Professional product polish

## Goal

Close the gap between “technically professional MVP” and “credible product a
prospect can understand, review, and request a demo from.”

## Work units

1. Root quality gates: replace stub `lint`/`typecheck` scripts, add the root
   lint gate to CI, and make project tests discover new phase contracts.
   Docker build stages also pin npm 11 before `npm ci`, matching the repo
   engine contract instead of relying on the base image's bundled npm.
2. Repository entry point: rewrite `README.md` around the implemented AURION
   product, architecture, verification commands, and operating status.
3. Dashboard polish: add responsive shell/table behavior and operator-facing
   launch/readiness cues without changing API contracts.
4. Landing polish: replace raw demo links with a structured demo-request form
   that hands off to email/WhatsApp and keeps measurement consent explicit.

## Acceptance criteria

- [x] `npm run lint` fails on the old professional-readiness regressions and
      passes on the polished state.
- [x] `npm run typecheck` runs real workspace typechecks from the root.
- [x] CI runs root lint and root typecheck.
- [x] Docker build stages use npm 11 before dependency installation.
- [x] README describes the implemented Vite/Nest/voice product, not an assumed
      future stack.
- [x] Dashboard CSS has an explicit mobile breakpoint and table overflow guard.
- [x] Landing has a structured demo form and no analytics loading before cookie
      consent.

## Follow-ups

- Wire a real booking calendar once Daniel chooses the calendar/provider URL.
- Add a CRM/lead persistence backend only after deciding the canonical system
  of record for sales leads.
- Add billing/usage once pricing is selected.
