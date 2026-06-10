---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-004, ADR-007, ADR-009, ADR-011, ADR-012
---

# ADR-013 — Voice sessions and controlled actions

## Decision

Implement the last two MVP contract groups from `ADR-009` — `/api/v1/voice-sessions`
and `/api/v1/actions` — with the following semantics:

1. **Explicit lifecycles** enforced as compare-and-set transitions (the
   pattern proven by knowledge documents in Phase 3).
2. **Idempotency-Key contract** for action requests: required header, replay
   returns the original resource, divergent replay is rejected.
3. **Human approval workflow** separated into request → approve/reject →
   execute, with a database-recorded approver and a self-approval ban.
4. **Column encryption in use** (`ADR-011`): `voice_sessions.summary` and
   controlled-action payloads are encrypted with `FieldEncryptionService`
   before they reach the database and decrypted only on authorized reads.

## Lifecycles

```
voice_sessions:    started → active → completed | failed
                   started | active → cancelled
controlled_actions: requested → approved | rejected
                    approved → executed | failed
                    requested → executed | failed   (only when approval is not required)
```

Terminal states never transition. Every transition is a compare-and-set
(`WHERE status = expected`): a concurrent change matches zero rows and
surfaces as a 409, never as a lost update.

## Idempotency contract (`POST /api/v1/actions`)

- The `Idempotency-Key` header is **required** (ADR-009: mutating endpoints
  that can be retried). It maps to the `controlled_actions.idempotency_key`
  column, unique per tenant.
- Replay with the **same key and same payload** returns the existing action
  with `200` (instead of `201`) — safe network retries.
- Replay with the same key and a **different payload** is a `409`: a key
  identifies one logical request, never two.
- Voice sessions get natural idempotency instead: `POST /api/v1/voice-sessions`
  with an `external_session_id` that already exists returns the existing
  session (`200`), backed by the partial unique index from migration `0001`.

## Approval workflow

- **Request** records the action with `approval_required` computed by the
  policy: human-approval-gated permissions (`ADR-007`) and any tool execution
  requested by a `voice_agent`.
- **Approve / reject** require a *human* (`user`) actor whose role grants the
  tool permission. The requester can never approve their own action
  (`approved_by_user_id` ≠ requester), and machine actors can never approve.
- **Execute** re-authorizes through the policy decision point, passing the
  database-recorded approval as `humanApproval`. This is the path the policy
  guard deliberately refuses to take from a client-supplied flag: approval
  evidence must come from the approval record, nowhere else.

## Policy decision point: `assessGrant`

`PolicyService` gains `assessGrant(request)`: the same actor / tenant /
role checks as `authorize`, but **without the human-approval gate**, returning
whether execution will require approval. It exists because *requesting* an
action must be allowed before any approval can exist; `authorize` remains the
only path that can green-light *execution*. Both emit audit evidence for
sensitive permissions.

Because the tool permission depends on the request body
(`tool:execute:<action_type>`), the actions endpoints cannot use the static
`@RequirePermission` decorator; the use case invokes the policy service
directly. The global guards still enforce authentication on every route.

## Encryption at rest in practice

| Column | Treatment |
|--------|-----------|
| `voice_sessions.summary` | Encrypted envelope string (`enc:v1:…`). |
| `controlled_actions.request_payload` / `result_payload` | JSONB wrapper `{"ciphertext": "enc:v1:…"}` around the encrypted canonical JSON. |

Reads decrypt only after authorization; a database-only compromise yields
ciphertext. Legacy plaintext values (none expected before this phase) are
passed through by an explicit `isEncrypted` check rather than failing reads.

## New permissions

- `conversation:write` — create/advance voice sessions: platform owner,
  tenant admin, voice agent, system.
- `action:read` — read controlled actions: platform owner, tenant admin,
  supervisor, auditor, voice agent (to poll its own requests).

## Consequences

- The MVP API surface from `ADR-009` is complete: all six contract groups.
- Real tool dispatch (calendar/ticket connectors via HERMES, `ADR-003`)
  remains out of scope: `execute` records the authorized state change and
  result payload; connectors land behind the same port later.
- A follow-up ADR still owes key rotation operations and crypto-shredding
  (carried from `ADR-011`/`ADR-012`).

## Out of scope

- HERMES connector execution and retries.
- Action cancellation endpoint (the `cancelled` status is reserved; the MVP
  withdrawal path is `reject`).
- External IdP (RS256 + JWKS), realtime/WebSocket session events.
