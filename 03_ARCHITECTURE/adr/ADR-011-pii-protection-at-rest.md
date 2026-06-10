---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-002, ADR-007, ADR-008, 13_COMPLIANCE/gdpr.md
---

# ADR-011 — PII protection at rest

## Decision

AURION protects personal and sensitive data at rest with a layered model:

1. **Tenant isolation** enforced in the database via Row-Level Security (RLS),
   not only in application code (migration `0002`).
2. **Append-only audit** evidence (database trigger blocks update/delete).
3. **Column-level encryption** for high-sensitivity fields (voice transcripts,
   summaries, and free-form tool payloads), implemented when the runtime
   persistence layer (`ADR-008`, Kysely + node-postgres) is introduced.
4. **Log redaction** of credentials, tokens, and personal data.

Items 1–2 are implemented now. Items 3–4 are committed decisions with a defined
trigger point (the first persistence adapter), recorded here so they are not
left to chance.

## Why

The MVP schema stores sensitive content: `voice_sessions.summary`,
`voice_sessions.transcript_uri`, and JSONB payloads in `controlled_actions`.
A multi-tenant SaaS that handles voice conversations must assume that database
access alone should not expose readable customer content, and that GDPR
obligations (`13_COMPLIANCE/gdpr.md`) require demonstrable controls.

## Scope of column-level encryption (when persistence lands)

| Data | Treatment |
|------|-----------|
| Voice transcripts / summaries | Encrypted at column level; keys managed outside the database. |
| Free-form tool request/result payloads (JSONB) | Encrypted or redacted per field policy before storage. |
| Email / display name | Stored as-is for operation; access controlled by RLS + policy. |
| Content hashes (`content_sha256`) | Plain; non-reversible integrity markers. |

Encryption uses authenticated encryption with keys held in the secrets manager
(`05_SECURITY/secrets-management.md`), never in the repository or the database.
`pgcrypto` is available, but application-side encryption is preferred so keys
never reach the database server.

## Redaction rules

- Logs must never contain raw tokens, credentials, or full personal data.
- The authorization audit sink records actor, tenant, action, outcome, and
  correlation id — not payload contents.

## Consequences

- The persistence layer PR must implement column encryption and redaction before
  real transcripts or payloads are stored beyond MVP placeholders.
- A follow-up ADR will define key rotation and crypto-shredding for data
  deletion / GDPR erasure.

## Out of scope

- Key management provider selection.
- Field-level access policies for analytics exports.
- Backup encryption and PITR (covered by data/ops ADRs).
