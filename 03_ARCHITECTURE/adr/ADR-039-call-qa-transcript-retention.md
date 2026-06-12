---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-12
related: ADR-009, ADR-011, ADR-012, ADR-013, ADR-015, ADR-035
---

# ADR-039 — Call QA, step 1: per-turn transcript retention

## Decision

AURION retains the conversation **turn by turn**, so a human reviewer can
read what was actually said on a call — not just the closing summary. This
is the foundation of Phase 30 (Call QA): you cannot score a call, tune
turn-taking, or audit a voice you cannot review.

- **New table `voice_session_turns`** (migration 0003): `tenant_id`,
  `voice_session_id`, `turn_index`, `speaker` (`caller`|`agent`), `text`,
  `created_at`. One row per turn.
- **Same isolation and crypto posture as every tenant-owned table.** RLS
  tenant isolation (the `app.tenant_id` GUC, migration 0002); the spoken
  `text` is PII + conversation content, so it is **AES-256-GCM encrypted at
  the application layer** before storage (ADR-011/ADR-012) — a
  database-only compromise yields ciphertext, and crypto-shredding the
  tenant's key is the GDPR erasure lever (ADR-015).
- **A transcript is evidence: append-only.** The same
  `aurion_block_mutation` trigger that guards `audit_events` blocks
  UPDATE/DELETE — you cannot rewrite what was said. The session FK is
  `ON DELETE RESTRICT` (mirrors `controlled_actions`); the tenant FK is
  `ON DELETE CASCADE` (mirrors `audit_events`).
- **Two endpoints on the voice-sessions group.**
  `POST /voice-sessions/:id/turns` writes turns (the `voice_agent`'s
  `conversation:write`, idempotent on `(session, turn_index)` so a retry
  never duplicates a turn). `GET /voice-sessions/:id/turns` reads the
  decrypted transcript for QA — gated by the EXISTING `conversation:review`
  permission (already granted to tenant_admin, supervisor, auditor,
  platform_owner). No new permission is invented.
- **The gateway flushes the transcript in one batch at close, best-effort.**
  Writing per turn would add an API round-trip to the latency-critical call
  path (ADR-032); instead the gateway sends the whole transcript when the
  session ends (or aborts), and a failure there is logged but never blocks
  session close — the encrypted summary still persists as today.

## Context

Phase 29 made the audio professional; Phase 30 makes its quality
**measurable and auditable** — the layer an enterprise buyer trusts.
`voice_sessions` already carried an encrypted `summary` and an unused
`transcript_uri`, but never the turns themselves, so a reviewer could read
a 2 000-char gist and nothing more. Storing the turns is the prerequisite
for the next Phase 30 increments (conversation scoring, a QA dashboard).

## Consequences

- QA reviewers get the real conversation, tenant-isolated, encrypted, and
  immutable; scoring (next increment) reads this text record, not S2S audio
  (consistent with ADR-038 keeping text the source of truth).
- Best-effort retention means a transcript can be incomplete if the API is
  unreachable at close; the session record itself is never at risk. If
  completeness ever needs a guarantee, a retry/outbox is its own increment
  (YAGNI).
- A GDPR **retention window** (auto-expiry/erasure sweep) is NOT in this
  increment — the crypto-shredding posture (ADR-015) is the erasure lever
  for now; a scheduled sweep is tracked in the Phase 30 plan.
- Out of scope: audio recording/retention, conversation scoring, the QA
  dashboard surface (later Phase 30 increments).
