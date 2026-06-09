-- Reverse the security hardening migration in safe order:
-- drop policies, disable RLS, remove the append-only trigger and helpers.

BEGIN;

DROP POLICY IF EXISTS audit_events_isolation ON audit_events;
DROP POLICY IF EXISTS controlled_actions_isolation ON controlled_actions;
DROP POLICY IF EXISTS voice_sessions_isolation ON voice_sessions;
DROP POLICY IF EXISTS knowledge_documents_isolation ON knowledge_documents;
DROP POLICY IF EXISTS tenant_memberships_isolation ON tenant_memberships;
DROP POLICY IF EXISTS tenants_isolation ON tenants;

ALTER TABLE audit_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE controlled_actions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE controlled_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents NO FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships NO FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
DROP FUNCTION IF EXISTS aurion_block_mutation();
DROP FUNCTION IF EXISTS aurion_current_tenant_id();

COMMIT;
