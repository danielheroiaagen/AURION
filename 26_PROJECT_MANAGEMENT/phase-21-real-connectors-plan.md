---
project: AURION
document: Phase 21 Real Connectors Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-11
related: ADR-014, ADR-019, ADR-030
---

# Phase 21 — Real connectors: calendar, tickets, email, WhatsApp via n8n

Daniel's ask: HERMES connected to calendar, tickets, email AND WhatsApp.
ADR-030 routes execution through his own n8n (already on the production
VPS): one workflow per action type, provider credentials in n8n's vault,
evidence honesty preserved end to end.

## Work units

1. Catalog: `ACTION_TYPES` + permissions (`tool:execute:email.send`,
   `tool:execute:whatsapp.send`) + matrix (tenant_admin, voice_agent) +
   `05_SECURITY/permissions.md` + regenerated `openapi.json`.
2. Brains: LLM tool catalog and scripted patterns gain `email.send` and
   `whatsapp.send` — same approval-honesty wording.
3. Receiver: `CONNECTOR_MODE` stub|n8n (fail-closed `N8N_WEBHOOK_BASE`),
   generic `N8nConnector` (typed webhook, optional shared header,
   `connector_mode: "n8n"` stamp, non-JSON/failed → `connector_failed`),
   honest stubs for the two new types.
4. Workflow skeletons: `29_HERMES_AGENT_WORKFORCE/n8n-workflows/*.json`,
   importable; default evidence says `pending-configuration` until real
   provider nodes are wired (honesty rule).
5. Deploy: receiver joins `dokploy-network`, `CONNECTOR_MODE=n8n`,
   workflows imported into the VPS n8n and activated.

## Acceptance criteria

- [ ] A voice request can become each of the four action types, always
      approval-gated; the dashboard shows them.
- [ ] In n8n mode every execution calls the typed workflow and records
      its JSON evidence stamped `connector_mode: "n8n"`; n8n failures
      surface as `connector_failed`, never fabricated success.
- [ ] Stub mode still works for CI/dev (default), now for all four types.
- [ ] OpenAPI drift check green; all suites green in CI.

## Out of scope

- Per-tenant n8n routing; inbound n8n→AURION callbacks; workflow
  versioning. Real provider nodes inside the workflows are operator
  configuration (n8n UI), not AURION code.

## Closure evidence

To be completed at phase close.
