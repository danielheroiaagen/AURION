---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Esquema inicial PostgreSQL

## tenants

- id UUID PK.
- name.
- slug.
- status.
- settings JSONB.
- created_at.
- updated_at.

## users

- id UUID PK.
- tenant_id UUID FK nullable para usuarios plataforma.
- email.
- name.
- status.
- created_at.

## customers

- id UUID PK.
- tenant_id UUID FK.
- external_ref.
- name.
- phone.
- email.
- metadata JSONB.
- created_at.

## conversations

- id UUID PK.
- tenant_id UUID FK.
- customer_id UUID FK nullable.
- channel.
- status.
- started_at.
- ended_at.
- outcome.
- risk_level.

## voice_sessions

- id UUID PK.
- tenant_id UUID FK.
- conversation_id UUID FK.
- provider.
- transport.
- status.
- latency_ms.
- created_at.

## transcripts

- id UUID PK.
- tenant_id UUID FK.
- conversation_id UUID FK.
- speaker.
- text.
- timestamp.
- confidence.

## action_executions

- id UUID PK.
- tenant_id UUID FK.
- conversation_id UUID FK.
- tool_name.
- input_redacted JSONB.
- output_summary JSONB.
- status.
- risk_level.
- created_at.

## audit_events

- id UUID PK.
- tenant_id UUID FK.
- actor_type.
- actor_id.
- action.
- resource_type.
- resource_id.
- result.
- metadata JSONB.
- created_at.

## knowledge_sources

- id UUID PK.
- tenant_id UUID FK.
- title.
- source_type.
- status.
- version.
- created_at.

## knowledge_chunks

- id UUID PK.
- tenant_id UUID FK.
- knowledge_source_id UUID FK.
- content.
- metadata JSONB.
- embedding vector opcional.
