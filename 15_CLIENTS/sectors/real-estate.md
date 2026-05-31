---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Sector — Inmobiliaria

## Objetivo

Definir cómo adaptar AURION al sector de inmobiliaria.

## Casos de uso prioritarios

- Captación de leads.
- Visitas.
- Filtros de vivienda.
- Seguimiento.
- Crm.

## Reglas sectoriales

- No prometer disponibilidad sin consultar fuente.
- Registrar preferencias.


## Configuración recomendada

- Base de conocimiento sectorial validada.
- Escalado humano para casos sensibles.
- Herramientas limitadas por riesgo.
- Auditoría activa.
- Métricas específicas del sector.

## Criterio de salida a producción

El sector solo puede activarse cuando existan flujos probados, mensajes aprobados, herramientas configuradas y políticas de escalado claras.
