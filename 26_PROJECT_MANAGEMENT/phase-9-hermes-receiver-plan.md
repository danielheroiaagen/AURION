---
project: AURION
document: Phase 9 HERMES Receiver Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-10
related: ADR-003, ADR-014, ADR-019
---

# Phase 9 — HERMES dispatch receiver

Phase 9 implements the receiving half of the dispatch contract (`ADR-019`):
the service on the HERMES VPS that authenticates AURION's signed dispatches,
executes them at most once through connector adapters, and returns the JSON
evidence AURION encrypts at rest.

## Work units

1. `ADR-019` and this plan.
2. Service `apps/hermes-receiver` (zero runtime dependencies):
   - Fail-closed config (`HERMES_RECEIVER_SECRET` ≥ 32 chars, `PORT`,
     staleness window, dedupe capacity).
   - `security/signature.ts`: constant-time HMAC verification over the raw
     body + signed-timestamp staleness window, before any parsing.
   - `application/`: `ConnectorPort` + registry; dispatch handler with
     LRU-capped `action_id` dedupe (execute at most once, replay returns
     the original result).
   - `infrastructure/`: stub connectors (`connector_mode: "stub"` stamped),
     `node:http` server (POST-only, 1 MB body cap, uniform 401s,
     stable error codes).
3. Tests: Vitest (signature/staleness, dedupe semantics, unknown type 422,
   connector failure mapping, config fail-closed, HTTP server end-to-end on
   an ephemeral port with real signed requests); Python contract tests
   `tests/project/test_phase9_hermes_receiver.py`.
4. Docs and wiring: CHANGELOG, root scripts, `.env.example`, CI verify.

## Acceptance criteria

- [x] Signature is verified against raw bytes BEFORE parsing; bad signature
      and stale timestamp are uniform 401s; there is no unsigned mode
      (contract test enforces check ordering in the source).
- [x] A replayed `action_id` never re-executes; the original result returns
      (`replayed: true`); failures never poison the dedupe store.
- [x] Unknown action types are 422; connector failures are 502-style JSON
      with stable codes — never silent success.
- [x] Stub connector results are stamped `connector_mode: "stub"`.
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope (later phases)

- Real connector adapters (calendar/ticketing) and their credentials.
- Durable dedupe, queues/retries, multi-tenant credential routing.

## Closure evidence

Local verification passed on branch `phase-9/hermes-receiver` (2026-06-10):

- [x] `npm test` passed: **164** Python contract tests (13 new for phase 9).
- [x] `npm run test:hermes-receiver` passed: **12** Vitest tests, including
      an end-to-end suite against the real HTTP server on an ephemeral port
      with genuinely signed, tampered, and unsigned requests.
- [x] `npm --workspace @aurion/hermes-receiver run typecheck` and `build`
      passed; zero runtime dependencies confirmed by contract test.
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification passed on head `030d881` (2026-06-10), PR #23: all six
checks green on the first CI round.

Merge evidence: PR #23 squash-merged into `main` as `e36da13` on 2026-06-10.

Carried follow-ups: real connector adapters per integration, durable dedupe
when a connector demands it.
