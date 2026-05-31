---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Docker

## Objetivo

Estandarizar entornos y facilitar despliegue.

## Servicios esperados

- frontend.
- api.
- voice-runtime.
- memory-service.
- action-fabric.
- avatar-service.
- postgres.
- redis.
- worker.
- reverse-proxy.
- hermes-agent.

## Reglas

- Dockerfiles pequeños.
- No ejecutar como root si no es necesario.
- Variables por entorno.
- Healthchecks.
- Logs a stdout/stderr.
- Volúmenes para datos persistentes.

## Docker Compose inicial

Se usará para desarrollo y VPS inicial.

## Producción

Producción debe separar datos persistentes, secretos y backups con cuidado.
