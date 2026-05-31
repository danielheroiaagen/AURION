---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Handoffs entre agentes

## Objetivo

Definir cómo se transfiere trabajo entre agentes sin perder contexto.

## Formato obligatorio de handoff

```md
## Handoff

- Tarea original:
- Estado actual:
- Documentos consultados:
- Decisiones tomadas:
- Archivos afectados:
- Riesgos:
- Bloqueos:
- Tests pendientes:
- Siguiente agente recomendado:
```

## Handoffs comunes

### Product -> Architecture

Cuando un requisito necesita diseño técnico.

### Architecture -> Backend

Cuando existe ADR o diseño aprobado.

### Backend -> QA

Cuando hay caso de uso implementado.

### QA -> Security

Cuando un flujo toca datos, permisos o acciones críticas.

### DevOps -> Documentation

Cuando cambia despliegue, variables o infraestructura.

## Regla

Ningún agente debe continuar una tarea heredada sin leer el handoff.
