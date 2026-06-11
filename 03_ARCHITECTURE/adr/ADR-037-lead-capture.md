---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-12
related: ADR-013, ADR-030
---

# ADR-037 — Lead capture: AURION absorbs ORION's voice-lead flow

## Decision

A fifth action type, **`lead.capture`**, completes AURION's parity with
the ORION/VAPI automations: when an interested caller leaves their
details, AURION registers a lead (name, email, phone, interest) through
the SAME approval-gated path as every other action.

- Catalog end to end (like the phase-21 connectors): API `ACTION_TYPES`,
  `tool:execute:lead.capture` permission + matrix (tenant_admin,
  voice_agent), OpenAPI, both brains (LLM tool + scripted pattern on
  "me interesa / presupuesto / información"), receiver stub + n8n
  connector.
- The n8n workflow `aurion-lead.capture` writes to the operator's
  EXISTING Supabase table `voice_leads` (same table the old "VAPI Voice
  Lead" used: nombre, email, telefono, descripcion) and notifies by
  email — reusing the credentials already in n8n, so no secret enters
  AURION.

## Context

Apagar VAPI (ADR strategy note, 2026-06-11) left one capability AURION
did not have: lead capture. ORION's "VAPI Voice Lead" workflow saved
interested callers to Supabase and emailed a follow-up. Bringing it into
AURION's catalog means the migration off VAPI loses nothing.

## Consequences

- AURION now matches the four ORION voice automations end to end (book,
  email, ticket, WhatsApp) plus lead capture — all human-approved.
- Evidence honesty unchanged: stub mode stamps `connector_mode: "stub"`;
  n8n mode records the Supabase row id.
- Out of scope: lead scoring, CRM sync beyond Supabase, automated
  outbound follow-up (those stay n8n workflow edits, not AURION code).
