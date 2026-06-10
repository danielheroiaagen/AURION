---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-003, ADR-014, ADR-018
---

# ADR-019 — HERMES dispatch receiver

## Decision

The HERMES side of the dispatch contract
(`29_HERMES_AGENT_WORKFORCE/dispatch-receiver-contract.md`) is implemented as
`apps/hermes-receiver`: a **zero-runtime-dependency** Node service
(`node:http` + `node:crypto` only) that:

1. **Verifies before parsing.** The HMAC-SHA256 signature
   (`sha256=<hex>` over `"<timestamp>.<raw body>"`) is checked in constant
   time against the raw bytes BEFORE any JSON parsing; the staleness window
   (default 300s, both directions) is enforced on the signed timestamp.
   Failures are uniform 401s — unsigned traffic cannot probe parser
   behavior.
2. **Deduplicates by `action_id`.** A repeated `action_id` returns the
   original result with `replayed: true` semantics, executing at most once —
   the receiver-side mirror of AURION's `Idempotency-Key` contract that
   absorbs the documented double-dispatch race (ADR-014).
3. **Executes through a connector port.** `ConnectorPort` maps one
   `action_type` to one connector; unknown types are 422 rejections, never
   silent successes. First adapters are **stub connectors** whose results
   are stamped `connector_mode: "stub"` — the same honesty rule as the noop
   dispatcher: simulated work can never read as real work in AURION's
   evidence.

## Context

ADR-014 built AURION's sending half (signed dispatch, failure-as-result) and
phase 8's gateway closed the conversational loop — but dispatches still had
no real counterpart. ADR-003 places HERMES on its own VPS as the workforce
runtime; this receiver is its inbound edge. Real connectors (calendar
providers, ticketing systems) plug in behind `ConnectorPort` with their
credentials living only on the HERMES side (contract rule).

## Design constraints

- **Fail-closed startup**: `HERMES_RECEIVER_SECRET` (≥ 32 chars, must equal
  the API's `HERMES_DISPATCH_SECRET`) is required; there is no unsigned mode.
- **Dedupe store is in-memory with an LRU cap** (default 10 000 entries).
  Honest limitation: a receiver restart forgets processed ids — acceptable
  because AURION never auto-retries a dispatch (a failed action is terminal,
  ADR-014); the race window the dedupe absorbs is seconds wide. Durable
  dedupe arrives with a real connector that demands it.
- Responses are 2xx JSON objects only (they become AURION's encrypted
  execution evidence); errors are JSON with stable `code`s
  (`invalid_signature`, `stale_timestamp`, `bad_payload`,
  `unknown_action_type`, `connector_failed`).
- Body size is capped (1 MB) before signature verification reads it.

## Consequences

- The shared secret is symmetric and pairwise (API ↔ receiver); rotation is
  a coordinated config change documented in the key-rotation runbook style.
- Real connector adapters (and their secrets management) are per-integration
  work items; each lands behind `ConnectorPort` with its own contract tests.
- Out of scope: durable dedupe, connector retries/queues, multi-tenant
  connector credential routing (needs the integration-credentials surface),
  and HERMES's broader agent-workforce duties (ADR-003) — this service is
  only the dispatch edge.
