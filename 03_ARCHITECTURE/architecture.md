---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Arquitectura maestro de AURION

## Objetivo

Definir la arquitectura base de AURION para que todos los agentes humanos e IA construyan de forma coherente, escalable y mantenible.

## Estilo arquitectónico obligatorio

AURION usará:

- **Arquitectura hexagonal** para separar el dominio de frameworks, APIs, bases de datos y proveedores externos.
- **Clean Architecture** para organizar capas de dependencia hacia el dominio.
- **Domain-Driven Design ligero** para modelar entidades, agregados, casos de uso y eventos del negocio.

## Regla de dependencia

Las dependencias siempre apuntan hacia dentro:

`Infrastructure -> Interface Adapters -> Application -> Domain`

El dominio nunca debe importar:

- Next.js.
- NestJS.
- FastAPI.
- PostgreSQL.
- Redis.
- OpenAI SDK.
- LiveKit SDK.
- Hermes Agent.
- HeyGen/LiveAvatar.

## Capas

### Domain

Contiene reglas puras de negocio:

- Tenant.
- Customer.
- Conversation.
- VoiceSession.
- AgentProfile.
- ToolPermission.
- ActionExecution.
- AuditEvent.
- KnowledgeSource.
- EscalationPolicy.

### Application

Contiene casos de uso:

- StartVoiceSession.
- ProcessUserIntent.
- ExecuteAuthorizedTool.
- EscalateConversation.
- SummarizeCall.
- RegisterKnowledgeSource.
- EvaluateConversationQuality.

### Ports

Contratos que el dominio/aplicación necesitan:

- ConversationRepository.
- CustomerRepository.
- ToolExecutorPort.
- VoiceProviderPort.
- AvatarProviderPort.
- MemorySearchPort.
- AuditLoggerPort.
- NotificationPort.

### Adapters

Implementaciones concretas:

- PostgreSQLConversationRepository.
- OpenAIRealtimeVoiceAdapter.
- LiveKitSIPAdapter.
- HeyGenAvatarAdapter.
- PgVectorMemoryAdapter.
- RedisSessionAdapter.

### Infrastructure

Frameworks, proveedores, bases de datos, colas, SDKs y servicios externos.

## Módulos principales

- Identity & Tenancy.
- Voice Core.
- Conversation Engine.
- Action Fabric.
- Memory Graph.
- HoloPresence.
- Command Center.
- Evaluation Engine.
- Audit & Compliance.
- Hermes Workforce.


## Stack base asumido

- **Frontend:** Next.js + React + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend principal:** NestJS o FastAPI, organizado con arquitectura hexagonal y Clean Architecture.
- **Realtime voice:** OpenAI Realtime / Voice Agents, WebRTC, SIP y LiveKit.
- **Telepresencia:** LiveAvatar, HeyGen o capa propia WebXR/Three.js en fases avanzadas.
- **Agentes internos:** Hermes Agent desplegado en VPS Hostinger con Docker.
- **Base de datos principal:** PostgreSQL.
- **Memoria semántica:** pgvector o Qdrant, con políticas de privacidad y retención.
- **Estado realtime:** Redis.
- **Eventos:** NATS, Kafka o cola equivalente según fase de escala.
- **Observabilidad:** OpenTelemetry, Grafana, Prometheus, Loki y trazas por conversación.
- **Infraestructura:** Docker, Docker Compose, VPS Hostinger para entorno inicial y preparación para cloud/kubernetes.


## Reglas técnicas

1. Ningún caso de uso debe llamar directamente a un SDK externo.
2. Toda integración externa debe pasar por un puerto.
3. Todo cambio de estado crítico debe emitir evento de dominio.
4. Todo evento crítico debe auditarse.
5. Toda herramienta ejecutable debe tener permisos, validación y trazabilidad.
6. Los adaptadores pueden cambiar sin reescribir el dominio.

## Arquitectura conceptual

```txt
Usuario / Teléfono / Web / Avatar
        ↓
Canales realtime: WebRTC / SIP / WebSocket
        ↓
Voice Core + Conversation Engine
        ↓
Application Use Cases
        ↓
Domain Model
        ↓
Ports
        ↓
Adapters: PostgreSQL, Redis, OpenAI, LiveKit, Avatar, CRM, Calendar
        ↓
Auditoría + Observabilidad + Evaluación
```

## Decisiones iniciales

- PostgreSQL será base principal.
- pgvector se considerará primera opción para memoria semántica cuando sea suficiente.
- LiveKit será preferido para WebRTC/SIP.
- OpenAI Realtime será proveedor inicial de voz IA.
- Hermes Agent se desplegará como workforce interno, no como runtime directo de llamadas críticas.
- Docker será obligatorio desde el inicio.
