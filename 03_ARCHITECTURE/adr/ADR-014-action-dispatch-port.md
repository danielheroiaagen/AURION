---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-003, ADR-007, ADR-009, ADR-013
---

# ADR-014 — Action dispatch behind an executor port

## Decision

Controlled action execution is dispatched through a driven port,
`ActionDispatcherPort`, owned by the actions application layer. The HTTP
endpoint `POST /api/v1/actions/:id/execute` **no longer accepts a
`result_payload` from the client**: execution evidence can only come from the
dispatcher. Two adapters implement the port:

1. **`HermesHttpDispatcher`** — production adapter. POSTs the action to the
   HERMES workforce endpoint (ADR-003) as a signed JSON message and treats the
   2xx JSON response as the execution result.
2. **`NoopDispatcher`** — explicit development/CI adapter. Performs no external
   call and returns a result payload that *honestly marks itself* as
   `{"dispatch_mode": "noop"}` so simulated executions can never be mistaken
   for real ones in the audit trail.

## Context

Phase 4 (ADR-013) implemented the request → approve/reject → execute workflow,
but `execute` recorded a client-supplied `result_payload`. That was acceptable
to close the workflow contract, and it is not acceptable for production: a
caller could fabricate execution evidence for a tool that never ran. The
product promise (ADR-004) is that a conversation can *safely act and leave
evidence* — evidence must therefore originate at the executor boundary, not at
the HTTP client.

HERMES (ADR-003) is the internal workforce that owns real connector execution
(calendar, ticketing). It runs on a separate VPS and must not be trusted
implicitly either: messages to it are signed, and its responses are recorded
verbatim as evidence.

## Dispatch contract

The port is deliberately narrow:

```ts
interface ActionDispatcherPort {
  dispatch(input: DispatchInput): Promise<DispatchResult>;
}

type DispatchResult =
  | { ok: true; resultPayload: Record<string, unknown> }
  | { ok: false; errorCode: string; message: string };
```

- `DispatchInput` carries `actionId`, `tenantId`, `actionType`,
  `requestPayload`, and `correlationId` — everything HERMES needs, nothing
  more. Approval state is **not** forwarded: by the time dispatch happens the
  policy decision point has already authorized execution (ADR-013), and the
  executor must not re-derive authority from a flag it could misread.
- Adapters never throw for runtime failures (timeouts, non-2xx, bad JSON):
  they return `{ ok: false }` so the use case can settle the action
  deterministically. Only programming errors propagate.

### Use-case behaviour (`ControlledActionsService.execute`)

1. Re-authorize via `PolicyService.authorize` with the database-recorded
   approval (unchanged from ADR-013).
2. Dispatch through the port.
3. `ok: true` → CAS-transition the action to `executed`, persisting the
   dispatcher's `resultPayload` (encrypted at rest per ADR-011/ADR-013).
4. `ok: false` → CAS-transition to `failed`, persisting
   `{ error: { code, message } }` as the result evidence, then surface a
   **502 Bad Gateway** Problem Details response. The failure is recorded
   *before* the error is thrown: evidence never depends on the client
   handling the response.

The lifecycle map gains `requested → failed` (non-gated actions can fail at
dispatch without ever being approved), mirroring the database CHECK
constraint, which already allows it.

## HERMES HTTP adapter

- **Endpoint**: `HERMES_DISPATCH_URL` (must be `https://` outside tests).
- **Authentication**: HMAC-SHA256 request signing with
  `HERMES_DISPATCH_SECRET` (≥ 32 chars). Headers:
  - `X-Aurion-Timestamp`: unix epoch milliseconds at send time.
  - `X-Aurion-Signature`: `sha256=<hex hmac>` over
    `"<timestamp>.<raw body>"`. The timestamp inside the signed string makes
    replayed captures detectable; HERMES rejects stale timestamps.
  - `X-Correlation-Id`: propagated for end-to-end tracing.
- **Timeout**: `HERMES_DISPATCH_TIMEOUT_MS` (default 10000) via
  `AbortController`. A timeout is a dispatch failure (`errorCode:
  "dispatch_timeout"`), never an unhandled rejection.
- **Response contract**: 2xx with a JSON object body → success result.
  Anything else (non-2xx, non-object JSON, network error) → failure result
  with a stable `errorCode` (`dispatch_rejected`, `dispatch_invalid_response`,
  `dispatch_unreachable`).
- The adapter sends the **plaintext** request payload: encryption at rest
  (ADR-011) protects the database, while transport protection is TLS. Payload
  encryption keys never leave the API process.

## Mode selection (fail closed)

`ACTION_DISPATCH_MODE` selects the adapter at startup:

- `hermes` — requires `HERMES_DISPATCH_URL` and `HERMES_DISPATCH_SECRET`; the
  API refuses to start if either is missing or the secret is weak.
- `noop` — default for local development and CI. Every result payload is
  stamped `dispatch_mode: "noop"`; production deployments must set
  `ACTION_DISPATCH_MODE=hermes` explicitly, and the runbook treats a `noop`
  stamp in production audit evidence as an incident signal.

## Consequences

- `ExecuteActionDto` loses `result_payload`; the execute route takes no body.
  This is a breaking change to a one-phase-old contract, recorded here, and it
  is the right direction: evidence integrity beats backwards compatibility at
  this stage.
- HERMES connector *implementations* (real calendar/ticket systems) live on
  the HERMES side behind its own contract; AURION's API depends only on this
  port. New action types require a permission catalog entry (ADR-007) and a
  HERMES connector — no API architecture change.
- Retrying a failed dispatch is a new `POST /actions` request with a new
  `Idempotency-Key` (a failed action is terminal evidence, never mutated).
- Out of scope: asynchronous dispatch with callbacks/webhooks from HERMES,
  per-connector circuit breakers, and outbox-based delivery. Revisit when
  call volume justifies the operational cost.
