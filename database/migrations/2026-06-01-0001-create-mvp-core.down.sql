BEGIN;

DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS controlled_actions;
DROP TABLE IF EXISTS voice_sessions;
DROP TABLE IF EXISTS knowledge_documents;
DROP TABLE IF EXISTS tenant_memberships;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tenants;

COMMIT;
