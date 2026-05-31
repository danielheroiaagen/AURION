---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Arquitectura de eventos

## Objetivo

AURION usará eventos para desacoplar acciones críticas, auditoría, evaluación, analítica y procesos asíncronos.

## Tipos de eventos

### Eventos de dominio

- ConversationStarted.
- UserIntentDetected.
- ToolExecutionRequested.
- ToolExecutionApproved.
- ToolExecutionCompleted.
- ToolExecutionFailed.
- ConversationEscalated.
- ConversationResolved.
- KnowledgeSourceIngested.

### Eventos técnicos

- RealtimeConnectionOpened.
- RealtimeConnectionClosed.
- ProviderLatencyHigh.
- RedisSessionExpired.
- WebhookDeliveryFailed.

### Eventos de auditoría

- SensitiveDataAccessed.
- PermissionDenied.
- AdminSettingChanged.
- SecretRotated.

## Reglas

1. Todo evento crítico debe incluir `tenant_id`.
2. Todo evento de acción debe incluir actor, herramienta, input sanitizado, resultado y timestamp.
3. Eventos de auditoría no deben poder modificarse.
4. Los eventos no deben contener secretos.
5. Los eventos con datos personales deben cumplir política de retención.

## Uso inicial

En fase inicial puede usarse cola ligera. En fase de escala se migrará a NATS/Kafka si el volumen lo requiere.
