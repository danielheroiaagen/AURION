---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# ADR-002 — PostgreSQL como base de datos principal

## Estado

Aceptado.

## Contexto

AURION necesita datos relacionales, multi-tenant, auditoría, consistencia y extensiones como pgvector.

## Decisión

PostgreSQL será la base de datos principal.

## Motivos

- Madurez.
- Transacciones.
- Índices avanzados.
- JSONB.
- Extensiones.
- Buen soporte multi-tenant.
- Compatible con pgvector.

## Consecuencias

El diseño de datos debe contemplar tenant_id, migraciones, backups, índices y políticas de retención desde el inicio.
