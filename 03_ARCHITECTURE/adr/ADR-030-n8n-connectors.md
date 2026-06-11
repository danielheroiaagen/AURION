---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-014, ADR-019, ADR-022
---

# ADR-030 — Real connectors run as n8n workflows

## Decision

HERMES executes real-world actions through the operator's **own n8n
instance** (already running on the production VPS), one workflow per
action type:

- **`CONNECTOR_MODE` on the receiver:** `stub` (default, the honest
  simulators) or `n8n`. n8n mode registers an `N8nConnector` for every
  catalog type, POSTing `{ action_type, payload }` to
  `<N8N_WEBHOOK_BASE>/aurion-<action_type>` over the private container
  network, with an optional `x-aurion-secret` header workflows can
  verify. Fail-closed: n8n mode refuses to boot without the base URL.
- **The action catalog grows to four types** end to end —
  `ticket.create`, `calendar.update`, **`email.send`**,
  **`whatsapp.send`** — in the API (`ACTION_TYPES`, permissions,
  matrix), the brains (LLM tool catalog + scripted patterns), and the
  receiver (stubs + n8n connectors). Same approval gate for all: a
  voice_agent can only REQUEST.
- **Evidence honesty extends into n8n:** the workflow's JSON response
  becomes the recorded evidence, stamped `connector_mode: "n8n"` +
  `workflow`. The repo ships importable workflow skeletons
  (`29_HERMES_AGENT_WORKFORCE/n8n-workflows/`) whose default response is
  `integration: "pending-configuration"` — a workflow that does not yet
  touch a real calendar SAYS SO in the evidence, exactly like the noop
  dispatcher and the stub connectors (ADR-014/ADR-019). When Daniel
  wires real nodes (Google Calendar, Gmail, Twilio WhatsApp) the
  evidence carries their real ids.

## Context

Phase 9 built the receiver with honest stubs and a connector-per-type
seam. Daniel wants calendar, tickets, email AND WhatsApp live. Writing
four bespoke provider integrations (Google OAuth, SMTP, Meta WhatsApp)
into the receiver would put third-party credentials in AURION's code
path and make every integration change a deploy. His n8n already solves
exactly this: hundreds of maintained provider nodes, a credentials vault,
and a UI the operator ALREADY uses — the receiver only needs to speak
webhook.

## Consequences

- New integrations and changes are n8n edits (no-code, Daniel's own
  tool), not AURION deploys; AURION's audit trail still records every
  execution with the workflow's evidence.
- Credentials boundary improves: provider secrets live in n8n's vault;
  the receiver holds only the webhook base and an optional shared header
  secret.
- n8n becomes a runtime dependency OF THE CONNECTOR PATH only — if n8n
  is down, executions fail loudly (`connector_failed`) and can be
  retried after approval; conversations and approvals are unaffected.
- Out of scope: per-tenant n8n routing, workflow versioning/promotion,
  inbound n8n→AURION callbacks (poll/evidence is enough for v1).
