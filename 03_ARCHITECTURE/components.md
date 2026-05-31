---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# C4 Nivel 3 — Componentes

## Core Backend

### Tenant Module

- Tenant entity.
- Tenant settings.
- Tenant limits.
- Tenant billing status futuro.

### Conversation Module

- Conversation aggregate.
- VoiceSession.
- Transcript.
- ConversationSummary.
- ConversationOutcome.

### Action Module

- Tool registry.
- Permission policy.
- Action execution.
- Approval workflow.

### Knowledge Module

- KnowledgeSource.
- Document ingestion.
- Chunking.
- Embedding job.
- Retrieval.

### Audit Module

- AuditEvent.
- Append-only log.
- Risk level.
- Actor identity.

### Evaluation Module

- Conversation scoring.
- Hallucination detection.
- Escalation quality.
- Tool execution quality.

## Voice Runtime

### Session Manager

Gestiona sesiones activas.

### Turn Manager

Gestiona turnos, interrupciones y silencios.

### Realtime Adapter

Conecta con proveedor de voz IA.

### Tool Bridge

Permite que el modelo solicite herramientas controladas.

### Escalation Bridge

Conecta con humano o cola.

## Avatar Service

### Avatar Session

Estado de presencia visual.

### Lipsync Adapter

Sincronización voz-boca.

### Provider Adapter

HeyGen, LiveAvatar o proveedor propio.
