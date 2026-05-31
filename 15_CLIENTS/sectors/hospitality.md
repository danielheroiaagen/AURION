---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Sector — Hostelería y hoteles

## Objetivo

Definir cómo adaptar AURION al sector de hostelería y hoteles.

## Casos de uso prioritarios

- Reservas.
- Check-in.
- Servicios.
- Incidencias.
- Upselling.

## Reglas sectoriales

- Confirmar fechas y precios con sistema.
- Escalar quejas sensibles.


## Configuración recomendada

- Base de conocimiento sectorial validada.
- Escalado humano para casos sensibles.
- Herramientas limitadas por riesgo.
- Auditoría activa.
- Métricas específicas del sector.

## Criterio de salida a producción

El sector solo puede activarse cuando existan flujos probados, mensajes aprobados, herramientas configuradas y políticas de escalado claras.
