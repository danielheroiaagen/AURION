---
project: AURION
document: Phase 15 Design Polish Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
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

- [x] Both apps build with the token-based stylesheets; no component
      class renamed; runtime dependency sets unchanged (contract-tested).
- [x] Every mic failure mode shows a specific message (tested per reason);
      reception path proven by the live round-trip tool.
- [x] All suites pass locally and in CI with 0 vulnerabilities.

## Out of scope

- Per-tenant widget theming API, server-side STT (media-server phase),
  light mode.

## Closure evidence

Local verification passed on branch `phase-15/design-polish` (2026-06-11):

- [x] `npm test` passed: **231** Python contract tests (8 new in
      `tests/project/test_phase15_design.py`).
- [x] `npm run test:widget` passed: **8** Vitest tests covering every
      `ListenResult` failure reason.
- [x] `node --check` clean on both demo tools.

Remote verification on PR #29: the first CodeQL round flagged 2 new
alerts in the demo tooling (`js/request-forgery` critical,
`js/user-controlled-bypass` high). Both were fixed, not dismissed —
action ids are accepted only as literal UUIDs and every API path segment
is URI-encoded (`2923a9f`); mic-check tracks the protocol sequence
locally and never exits from network input (`9bf8f46`). All seven checks
green on head `2923a9f` (2026-06-11).

Merge evidence: PR #29 squash-merged into `main` as `80040f1` on
2026-06-11.

Next (authorized by Daniel on 2026-06-11): phase 16 replaces the broken
browser STT with a server-side OpenAI transcription port behind the
gateway — the real fix for the mic that this phase made diagnosable.
