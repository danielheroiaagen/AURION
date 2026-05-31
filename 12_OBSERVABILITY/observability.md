---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Observabilidad

## Objetivo

Saber qué ocurre en AURION.

## Alcance

Este documento aplica a AURION completo, incluyendo plataforma SaaS, agentes de voz, avatar, Hermes Agent workforce, datos, infraestructura y operaciones.

## Puntos principales

- Logs.
- Metrics.
- Traces.
- Audit events.
- Conversation timeline.
- Provider latency.

## Reglas

- Sin observabilidad no hay producción seria.


## Checklist para agentes IA

Antes de modificar este ámbito, el agente debe:

1. Leer este documento.
2. Revisar documentos relacionados.
3. Proponer cambios mínimos y justificados.
4. Añadir o actualizar tests si aplica.
5. Actualizar changelog o decisiones si corresponde.

## Criterio de aceptación

El trabajo relacionado con este documento se considera correcto cuando es seguro, verificable, documentado y coherente con arquitectura hexagonal, Clean Architecture y PostgreSQL como base principal.
