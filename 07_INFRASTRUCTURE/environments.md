---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Entornos

## Local

Uso: desarrollo individual.

Datos: ficticios.

## Development

Uso: integración continua de trabajo.

Datos: sintéticos.

## Staging

Uso: validación antes de producción.

Debe parecerse a producción.

## Production

Uso: clientes reales.

Máximo control, backups, logs y aprobación.

## Reglas

- Nunca usar datos reales en local sin anonimización.
- Nunca compartir secretos entre entornos.
- Toda variable debe documentarse.
- Toda migración se prueba antes en staging.
