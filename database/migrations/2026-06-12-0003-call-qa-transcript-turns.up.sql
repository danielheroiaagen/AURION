-- AURION call QA: per-turn transcript retention (ADR-039, Phase 30).
--
-- The conversation, turn by turn, retained so a human reviewer can read what
-- was actually said (conversation:review) — not just the closing summary.
--
-- The spoken/heard TEXT is PII and conversation content, so it is encrypted at
-- the application layer (AES-256-GCM, ADR-011/ADR-012) BEFORE it reaches this
-- table: a database-only compromise yields ciphertext, and crypto-shredding
-- the tenant's key renders it unreadable (GDPR erasure lever, ADR-015).
--
-- A transcript is evidence: append-only, like audit_events (migration 0002).
-- Isolation is the same RLS contract as every tenant-owned table — the
-- application sets app.tenant_id per request and the policy does the rest.

BEGIN;

CREATE TABLE voice_session_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  voice_session_id UUID NOT NULL,
  turn_index INTEGER NOT NULL CHECK (turn_index >= 0),
  speaker TEXT NOT NULL CHECK (speaker IN ('caller', 'agent')),
  -- Encrypted at the application layer before storage (ADR-011/ADR-012).
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Tenant-consistent reference; sessions are never hard-deleted (RESTRICT),
  -- mirroring controlled_actions.
  FOREIGN KEY (tenant_id, voice_session_id)
    REFERENCES voice_sessions(tenant_id, id)
    ON DELETE RESTRICT,
  -- Idempotency: a retried write of the same turn is ignored, never duplicated.
  UNIQUE (tenant_id, voice_session_id, turn_index)
);

CREATE INDEX voice_session_turns_session_idx
  ON voice_session_turns (tenant_id, voice_session_id, turn_index);

-- Tenant isolation (same contract as migration 0002): no tenant context → no rows.
ALTER TABLE voice_session_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_session_turns FORCE ROW LEVEL SECURITY;
CREATE POLICY voice_session_turns_isolation ON voice_session_turns
  USING (tenant_id = aurion_current_tenant_id())
  WITH CHECK (tenant_id = aurion_current_tenant_id());

-- A transcript is evidence: insert and read only (reuses the audit guard).
CREATE TRIGGER voice_session_turns_append_only
  BEFORE UPDATE OR DELETE ON voice_session_turns
  FOR EACH ROW
  EXECUTE FUNCTION aurion_block_mutation();

COMMIT;
