---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Sector — Seguros

## Objetivo

Definir cómo adaptar AURION al sector de seguros.

## Casos de uso prioritarios

- Primer aviso.
- Estado de póliza.
- Documentación.
- Derivación.
- Citas.

## Reglas sectoriales

- No interpretar cobertura legal sin fuente.
- Escalar reclamaciones complejas.


## Configuración recomendada

- Base de conocimiento sectorial validada.
- Escalado humano para casos sensibles.
- Herramientas limitadas por riesgo.
- Auditoría activa.
- Métricas específicas del sector.

## Criterio de salida a producción

El sector solo puede activarse cuando existan flujos probados, mensajes aprobados, herramientas configuradas y políticas de escalado claras.
