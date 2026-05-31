---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Sector — Educación

## Objetivo

Definir cómo adaptar AURION al sector de educación.

## Casos de uso prioritarios

- Admisiones.
- Horarios.
- Pagos.
- Soporte alumnos.
- Orientación.

## Reglas sectoriales

- No exponer datos de menores.
- Validar identidad si hay datos académicos.


## Configuración recomendada

- Base de conocimiento sectorial validada.
- Escalado humano para casos sensibles.
- Herramientas limitadas por riesgo.
- Auditoría activa.
- Métricas específicas del sector.

## Criterio de salida a producción

El sector solo puede activarse cuando existan flujos probados, mensajes aprobados, herramientas configuradas y políticas de escalado claras.
