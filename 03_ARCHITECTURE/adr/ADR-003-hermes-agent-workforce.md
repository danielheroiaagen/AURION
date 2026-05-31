---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# ADR-003 — Hermes Agent como workforce interno

## Estado

Aceptado.

## Contexto

AURION necesita agentes trabajadores para documentación, desarrollo, QA, seguridad, DevOps y mejora continua.

## Decisión

Hermes Agent se usará como workforce interno desplegado en VPS Hostinger, no como runtime principal de llamadas críticas.

## Motivos

- Permite skills y memoria.
- Puede asistir al desarrollo.
- Puede operar con MCP y herramientas.
- Reduce riesgo al separarlo del runtime realtime de cliente.

## Reglas

- Hermes no modifica producción sin aprobación.
- Hermes no accede a secretos sin permisos.
- Hermes debe consultar documentación antes de actuar.
- Hermes debe generar propuesta, tests y justificación.
