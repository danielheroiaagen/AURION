---
project: AURION
document: HERMES Dispatch Receiver Contract
folder: 29_HERMES_AGENT_WORKFORCE
owner: Daniel Gonzalez Junco
status: active
created_at: 2026-06-10
related: ADR-003, ADR-014
---

# HERMES dispatch receiver contract

What the HERMES side MUST implement to receive controlled-action dispatches
from the AURION API (`HermesHttpDispatcher`, ADR-014). This is the
counterpart contract: the API's adapter is already built and tested; a
receiver that violates this document will lose evidence or accept forged
work orders.

## Request shape

`POST <HERMES_DISPATCH_URL>` with JSON body:

```json
{
  "action_id": "<uuid>",
  "tenant_id": "<uuid>",
  "action_type": "ticket.create",
  "request_payload": { },
  "correlation_id": "<string>"
}
```

Headers:

| Header | Content |
|--------|---------|
| `content-type` | `application/json` |
| `x-aurion-timestamp` | Unix epoch **milliseconds** at send time |
| `x-aurion-signature` | `sha256=<hex>` — HMAC-SHA256 over `"<timestamp>.<raw body>"` with the shared `HERMES_DISPATCH_SECRET` |
| `x-correlation-id` | Propagated for end-to-end tracing |

## Receiver obligations

1. **Verify the signature before parsing.** Compute HMAC-SHA256 with the
   shared secret over the literal string `"<x-aurion-timestamp>.<raw request
   body bytes>"` and compare in constant time against the hex value after
   `sha256=`. Reject mismatches with 401. Never parse JSON first: parse
   errors must not be distinguishable probes on unsigned traffic.
2. **Enforce a staleness window.** Reject requests whose timestamp is more
   than **300 seconds** away from receiver time (either direction) with 401.
   The timestamp is inside the signed string, so a replayed capture cannot
   move it.
3. **Deduplicate by `action_id`.** `action_id` is the idempotency key: the
   API may double-dispatch under a concurrent-execute race (ADR-014). The
   receiver must execute a given `action_id` at most once and return the
   original result for repeats — same semantics AURION itself gives
   `Idempotency-Key`.
4. **Respond 2xx with a JSON object** — that object is recorded verbatim
   (encrypted at rest) as the execution evidence on the AURION side. Return
   only data that may live in the action record; never echo secrets.
5. **Any non-2xx, non-JSON, or timeout (>10s default) is recorded as a
   `failed` action** with the error code on the AURION side. There is no
   retry from the API: a new attempt is a new action. HERMES must therefore
   treat its own internal retries as part of one `action_id` execution.

## Connector rules (ADR-003 carried over)

- HERMES executes only the `action_type`s it has connectors for; an unknown
  type is a 4xx rejection, never a silent success.
- HERMES never widens authority: the dispatch arrives post-authorization
  (policy + human approval already enforced by AURION); HERMES must not
  re-expose these payloads to anything beyond the target connector.
- Connector credentials live on the HERMES side only; they never appear in
  result payloads.
