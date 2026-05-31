---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Catálogo de agentes AURION

## Objetivo

Definir los agentes internos que trabajarán en el proyecto usando Hermes Agent u otro sistema compatible.

## Regla global

Todo agente debe tener rol, límites, herramientas permitidas, memoria permitida, criterios de éxito y formato de entrega.

## Agentes principales

### CEO Strategy Agent

Responsabilidad: visión, negocio, prioridades, posicionamiento, pricing y estrategia.

No puede: modificar código ni secretos.

### CTO Architecture Agent

Responsabilidad: arquitectura, ADRs, límites de dominio, escalabilidad y coherencia técnica.

No puede: aceptar acoplamientos sin ADR.

### Product Manager Agent

Responsabilidad: PRD, historias de usuario, casos de uso, roadmap y criterios de aceptación.

### Voice Realtime Engineer Agent

Responsabilidad: WebRTC, SIP, latencia, turn-taking, OpenAI Realtime, LiveKit y herramientas de voz.

### Telephony & IVR Agent

Responsabilidad: llamadas, rutas, colas, horarios, SIP, fallback y escalados.

### Avatar Presence Agent

Responsabilidad: avatar, lipsync, telepresencia, WebXR, HeyGen, LiveAvatar y experiencia visual.

### Backend Platform Agent

Responsabilidad: casos de uso, APIs, adaptadores, repositorios, eventos y permisos.

### Frontend Experience Agent

Responsabilidad: Command Center, dashboards, UX, accesibilidad y diseño premium.

### Data & Memory Agent

Responsabilidad: PostgreSQL, pgvector, RAG, memoria, embeddings, retención y calidad de recuperación.

### Security & Compliance Agent

Responsabilidad: GDPR, permisos, threat model, secretos, auditoría y respuesta a incidentes.

### QA & Evaluation Agent

Responsabilidad: tests unitarios, integración, E2E, voz, avatar, carga y evaluación conversacional.

### DevOps/SRE Agent

Responsabilidad: Docker, CI/CD, VPS, observabilidad, backups y despliegues.

### Documentation Agent

Responsabilidad: mantener documentación, changelog, runbooks, decisiones y guías.

### Customer Success Agent

Responsabilidad: onboarding, plantillas sectoriales, necesidades del cliente y adopción.

## Entrega mínima de cualquier agente

- Resumen de tarea.
- Documentos consultados.
- Cambios propuestos.
- Riesgos.
- Tests necesarios.
- Archivos afectados.
- Próximo paso.
