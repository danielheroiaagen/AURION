---
project: AURION
document: Phase 14 Caller Voice Widget Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-10
related: ADR-004, ADR-018, ADR-024
---

# Phase 14 — Caller voice widget

Phase 14 gives the end customer their surface (`ADR-024`): an embeddable
zero-dependency widget that holds a real voice conversation through
browser-native speech over the existing gateway protocol. No media server,
no new infrastructure — that ADR arrives with telephony.

## Work units

1. `ADR-024` and this plan.
2. Workspace `apps/widget` (vanilla TS, zero runtime deps, Vite build):
   - `protocol.ts`: typed client-side mirror of the ADR-018 events.
   - `conversation-client.ts`: the only WebSocket door — callbacks out,
     reconnect-resume via `external_session_id` in `sessionStorage`,
     stable error surface.
   - `speech.ts`: recognition/synthesis wrappers with availability
     detection (mic only renders when the platform can listen).
   - `main.ts` + demo page: call UI (mic push-to-talk, transcript, action
     status with approval transparency, end call), text fallback.
3. Tests: Vitest with mocked WebSocket/speech globals (session resume id
   stability, event ordering, action transparency events, fallback
   detection); Python contract tests `tests/project/test_phase14_widget.py`.
4. CI verify wiring; CHANGELOG.

## Acceptance criteria

- [x] The widget completes a conversation against the gateway protocol:
      start → turns → action `approval_pending` surfaced to the caller →
      poll → end; reconnect resumes the same conversation record (resume id
      stable across connects, spent on `session.end` — tested).
- [x] Zero runtime dependencies (contract-tested); speech unavailability
      degrades to text without protocol changes (mocked-globals tests).
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope

- Telephony/SIP + media-server ADR, barge-in, theming API, per-caller
  signed call grants.

## Closure evidence

Local verification passed on branch `phase-14/caller-widget` (2026-06-10):

- [x] `npm test` passed: **223** Python contract tests (10 new).
- [x] `npm run test:widget` passed: **8** Vitest tests (mocked WebSocket +
      speech globals).
- [x] Widget typecheck and build passed — **2.48 kB gzip** bundle, zero
      runtime dependencies.
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification passed on head `4a2aba1` (2026-06-10), PR #28: all
seven checks green on the first round.

Merge evidence: PR #28 squash-merged into `main` as `76a89c8` on 2026-06-10.

**This closes the authorized frontend roadmap**: option B (metrics, phase
13) and option A (caller widget, this phase) are delivered; option C
(avatar) remains correctly vetoed by ADR-004 until the SaaS core is
validated with real customers. Remaining work is operational (IdP
onboarding, real HERMES connectors, VPS go-live) or deferred by ADR
(media server/telephony, per-tenant keys, streaming audio).
