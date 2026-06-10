---
project: AURION
document: Phase 15 Design Polish Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-10
related: ADR-017, ADR-024
---

# Phase 15 — Design polish, mic diagnostics, demo tooling

Daniel's feedback after seeing the live demo: the visual design was too
bare, and microphone failures were invisible. This phase fixes both and
ships the demo tooling that produced the walkthrough.

## Work units

1. Design tokens v1 ("deep ocean", `20_DESIGN_SYSTEM/design-tokens.md`,
   replacing the v0 placeholder): one palette/type/spacing/interaction
   language for dashboard and widget, implemented purely in CSS — class
   names untouched, zero new dependencies (ADR-017/ADR-024 rules hold),
   visible `:focus-visible` everywhere, status colors always paired with
   text.
2. Widget mic diagnostics: `listenOnce` returns a discriminated
   `ListenResult` — capture failures (`not-allowed`, `no-speech`,
   `network`, `unavailable`) are NEVER silent; each renders a specific
   on-screen explanation with the text fallback offered. (Chrome's
   recognizer is an online service; the `network` reason makes that
   visible instead of mysterious.)
3. Demo tooling: `tools/demo/run-demo.mjs` (full-stack bring-up with
   seeded tenant, knowledge, history, and a live workflow: one executed
   through real dispatch, one rejected, one awaiting approval) and
   `tools/demo/mic-check.mjs` (live gateway round-trip).
4. Tests updated (mic failure modes per reason); Python contract tests
   `tests/project/test_phase15_design.py`; CHANGELOG.

## Acceptance criteria

- [ ] Both apps build with the token-based stylesheets; no component
      class renamed; runtime dependency sets unchanged (contract-tested).
- [ ] Every mic failure mode shows a specific message (tested per reason);
      reception path proven by the live round-trip tool.
- [ ] All suites pass locally and in CI with 0 vulnerabilities.

## Out of scope

- Per-tenant widget theming API, server-side STT (media-server phase),
  light mode.

## Closure evidence

To be completed at phase close.
