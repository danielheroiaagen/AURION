-- AURION security hardening migration.
--
-- Goal: enforce tenant isolation and audit immutability at the database layer,
-- not only in application code. This is defense in depth for the multi-tenant
-- SaaS core (see ADR-007, ADR-008, and 05_SECURITY/threat-model.md).
--
-- Isolation contract: the application MUST set the tenant context per request
-- using a transaction-local GUC before touching tenant-owned tables:
--
--     SET LOCAL app.tenant_id = '<tenant-uuid>';
--
-- When the GUC is unset, `current_setting('app.tenant_id', true)` returns NULL
-- and every tenant policy below evaluates to FALSE, so the safe default is
-- "no rows" rather than "all rows". Platform-level operators connect with a
-- role that has the BYPASSRLS attribute (provisioned in infrastructure, not in
-- this migration) for cross-tenant administration.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tenant context helper
-- ---------------------------------------------------------------------------
-- Returns the active tenant id from the request-scoped GUC, or NULL when the
-- application has not established a tenant context. STRICT/STABLE so the planner
-- can cache it within a statement.
CREATE OR REPLACE FUNCTION aurion_current_tenant_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- 2. Append-only guard for audit evidence
-- ---------------------------------------------------------------------------
-- Audit logs are evidence. They may be inserted and read, never updated or
-- deleted. This trigger enforces append-only semantics regardless of which
-- database role performs the operation, which is stronger than relying on
-- GRANT/REVOKE alone.
CREATE OR REPLACE FUNCTION aurion_block_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not permitted.', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION aurion_block_mutation();

-- ---------------------------------------------------------------------------
-- 3. Row-Level Security on tenant-owned tables
-- ---------------------------------------------------------------------------
-- ENABLE turns RLS on; FORCE applies it to the table owner too, so a leaked or
-- misconfigured owner connection cannot silently bypass tenant boundaries.

-- tenants: a tenant can only see and act on its own row.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenants_isolation ON tenants
  USING (id = aurion_current_tenant_id())
  WITH CHECK (id = aurion_current_tenant_id());

-- tenant_memberships
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_memberships_isolation ON tenant_memberships
  USING (tenant_id = aurion_current_tenant_id())
  WITH CHECK (tenant_id = aurion_current_tenant_id());

-- knowledge_documents
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_documents_isolation ON knowledge_documents
  USING (tenant_id = aurion_current_tenant_id())
  WITH CHECK (tenant_id = aurion_current_tenant_id());

-- voice_sessions
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY voice_sessions_isolation ON voice_sessions
  USING (tenant_id = aurion_current_tenant_id())
  WITH CHECK (tenant_id = aurion_current_tenant_id());

-- controlled_actions
ALTER TABLE controlled_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlled_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_actions_isolation ON controlled_actions
  USING (tenant_id = aurion_current_tenant_id())
  WITH CHECK (tenant_id = aurion_current_tenant_id());

-- audit_events: tenant-scoped reads/inserts; updates/deletes already blocked by
-- the append-only trigger above.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_isolation ON audit_events
  USING (tenant_id = aurion_current_tenant_id())
  WITH CHECK (tenant_id = aurion_current_tenant_id());

COMMIT;
