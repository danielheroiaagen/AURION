---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Infraestructura

## Objetivo

Definir la infraestructura de AURION desde desarrollo hasta producción.

## Fase inicial

- VPS Hostinger para Hermes Agent y servicios internos controlados.
- Docker Compose para orquestación inicial.
- PostgreSQL.
- Redis.
- Backend.
- Frontend.
- Reverse proxy.
- Certificados TLS.

## Fase de escala

- Separación de servicios.
- Base de datos gestionada o cluster dedicado.
- Object storage.
- Workers separados.
- Observabilidad centralizada.
- Kubernetes si el volumen lo justifica.

## Entornos

- local.
- development.
- staging.
- production.

## Reglas

- Producción no comparte credenciales con desarrollo.
- Staging debe parecerse a producción.
- Todo servicio debe tener healthcheck.
- Todo despliegue debe tener rollback.
