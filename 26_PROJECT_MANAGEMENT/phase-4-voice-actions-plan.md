---
project: AURION
document: Phase 4 Voice Sessions & Controlled Actions Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in_progress
created_at: 2026-06-10
related: ADR-009, ADR-011, ADR-012, ADR-013
---

# Phase 4 — Voice sessions & controlled actions

Phase 4 completes the MVP API surface from `ADR-009` with the two contract
groups that carry the product's core risk: realtime conversation evidence and
bounded tool execution. It is the first consumer of the Phase 3 encryption
service (`voice_sessions.summary`, action payloads), implements the
`Idempotency-Key` contract, and turns the human-approval rules of `ADR-007`
into a database-backed workflow (`ADR-013`).

## Work units

1. `ADR-013` and this plan.
2. Policy layer: `conversation:write` and `action:read` permissions (catalog,
   matrix, `05_SECURITY/permissions.md`); `PolicyService.assessGrant` for the
   request stage of approval-gated actions.
3. `voice-sessions` module (hexagonal): lifecycle
   `started → active → completed | failed` (+ `cancelled`), CAS transitions,
   summary encrypted at rest, natural idempotency on `external_session_id`,
   cursor-paginated list.
4. `actions` module (hexagonal): required `Idempotency-Key` with
   same-payload replay / divergent-replay 409, request → approve/reject →
   execute workflow with self-approval ban and machine-approver ban, payloads
   encrypted at rest, execution re-authorized through `PolicyService` with
   the recorded approval, cursor-paginated list.
5. `@CorrelationId()` param decorator so controllers can stamp
   `controlled_actions.correlation_id` from the request context.
6. Tests: Jest unit suites (lifecycles, idempotency semantics, approval
   rules, `assessGrant`); integration suite
   `test/integration/voice-actions.spec.ts` proving against real PostgreSQL
   that summaries/payloads are ciphertext at rest (raw admin read), replay is
   idempotent, the full request→approve→execute flow works, and RLS isolates
   tenants; Python contract tests `test_phase4_voice_actions.py`.
7. Docs: CHANGELOG; phase closure evidence.

## Acceptance criteria

- [x] All six ADR-009 contract groups exist; voice sessions and actions are
      tenant-scoped, deny-by-default, Problem-Details-erroring, cursor-paginated.
- [x] `voice_sessions.summary` and action payloads are stored encrypted
      (verified by reading raw columns in integration tests) and decrypted on
      authorized reads.
- [x] `POST /api/v1/actions` without `Idempotency-Key` is a 400; replay with
      the same key+payload returns the original (200); divergent replay is 409.
- [x] Approval workflow: requester cannot approve own action; machine actors
      cannot approve; execution without required approval is denied and
      audited; execution with recorded approval succeeds and is audited.
- [x] Lifecycle transitions are compare-and-set; concurrent/illegal
      transitions surface as 409.
- [x] `npm test`, `npm run test:api`, integration suite, typecheck, and build
      pass locally and in CI with 0 vulnerabilities (local pass evidenced
      below; CI parity pending push).

## Out of scope (next phases)

- HERMES connector execution (real calendar/ticket dispatch).
- Key rotation operations / crypto-shredding ADR.
- External IdP (RS256 + JWKS), WebSocket event contracts.

## Closure evidence

Local verification passed on branch `phase-4/voice-sessions-actions`
(2026-06-10):

- [x] `npm test` passed: **90** Python contract tests (15 new for phase 4).
- [x] `npm run test:api` passed: **92** Jest unit tests (9 suites).
- [x] `npm run test:api:integration` passed against a disposable
      `postgres:16` container: **17** integration tests (2 suites), including
      ciphertext-at-rest verification via raw column reads, idempotent
      replays, the full request → approve → execute flow, and RLS isolation
      for both new tables.
- [x] `npm --workspace @aurion/api run typecheck` and `build` passed.
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification: to be completed at phase close (PR + CI runs).
