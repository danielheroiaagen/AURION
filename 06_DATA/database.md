---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Base de datos

## Motor principal

PostgreSQL será la base principal de AURION.

## Principios

- Multi-tenant desde diseño.
- Migraciones versionadas.
- Índices pensados para consultas reales.
- Datos sensibles minimizados.
- Auditoría separada.
- Soft delete donde aplique.
- Retención definida.

## Entidades principales

- tenants.
- users.
- roles.
- permissions.
- customers.
- conversations.
- voice_sessions.
- transcripts.
- conversation_summaries.
- tools.
- tool_permissions.
- action_executions.
- knowledge_sources.
- knowledge_chunks.
- embeddings.
- audit_events.
- evaluations.
- escalations.

## Reglas multi-tenant

Toda tabla de negocio debe tener `tenant_id` salvo tablas globales controladas.

Toda query de negocio debe filtrar por `tenant_id`.

Se evaluará Row Level Security cuando el diseño lo requiera.

## Migraciones

- Nunca modificar producción manualmente.
- Toda migración debe tener rollback o estrategia de reversión.
- Migraciones destructivas requieren revisión.
- Los agentes IA no ejecutan migraciones productivas sin aprobación.
