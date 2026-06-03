BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_unique
  ON users (lower(email));

CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_owner', 'tenant_admin', 'supervisor', 'human_agent', 'developer_integrator', 'auditor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX tenant_memberships_tenant_id_idx
  ON tenant_memberships (tenant_id);

CREATE INDEX tenant_memberships_user_id_idx
  ON tenant_memberships (user_id);

CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_uri TEXT,
  content_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_memberships(tenant_id, user_id)
    ON DELETE SET NULL (created_by_user_id)
);

CREATE INDEX knowledge_documents_tenant_status_idx
  ON knowledge_documents (tenant_id, status);

CREATE UNIQUE INDEX knowledge_documents_tenant_content_unique
  ON knowledge_documents (tenant_id, content_sha256);

CREATE TABLE voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_session_id TEXT,
  started_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'active', 'completed', 'failed', 'cancelled')),
  transcript_uri TEXT,
  summary TEXT,
  outcome TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, started_by_user_id)
    REFERENCES tenant_memberships(tenant_id, user_id)
    ON DELETE SET NULL (started_by_user_id),
  UNIQUE (tenant_id, id)
);

CREATE INDEX voice_sessions_tenant_status_idx
  ON voice_sessions (tenant_id, status, started_at DESC);

CREATE UNIQUE INDEX voice_sessions_tenant_external_unique
  ON voice_sessions (tenant_id, external_session_id)
  WHERE external_session_id IS NOT NULL;

CREATE TABLE controlled_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  voice_session_id UUID,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'executed', 'failed', 'cancelled')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'voice_agent', 'system')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, actor_user_id)
    REFERENCES tenant_memberships(tenant_id, user_id)
    ON DELETE SET NULL (actor_user_id),
  FOREIGN KEY (tenant_id, approved_by_user_id)
    REFERENCES tenant_memberships(tenant_id, user_id)
    ON DELETE SET NULL (approved_by_user_id),
  FOREIGN KEY (tenant_id, voice_session_id) REFERENCES voice_sessions(tenant_id, id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX controlled_actions_tenant_status_idx
  ON controlled_actions (tenant_id, status, created_at DESC);

CREATE INDEX controlled_actions_tenant_voice_session_idx
  ON controlled_actions (tenant_id, voice_session_id);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'voice_agent', 'system')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied', 'succeeded', 'failed')),
  correlation_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, actor_user_id)
    REFERENCES tenant_memberships(tenant_id, user_id)
    ON DELETE SET NULL (actor_user_id)
);

CREATE INDEX audit_events_tenant_created_idx
  ON audit_events (tenant_id, created_at DESC);

CREATE INDEX audit_events_correlation_id_idx
  ON audit_events (correlation_id);

COMMIT;
