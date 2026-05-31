---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Reglas arquitectónicas

## Regla 1

El dominio no conoce infraestructura.

## Regla 2

Los casos de uso orquestan, no implementan detalles externos.

## Regla 3

Los adaptadores traducen entre mundo externo y puertos internos.

## Regla 4

Toda acción crítica pasa por policy engine y audit log.

## Regla 5

Toda tabla de negocio debe respetar tenant.

## Regla 6

Todo proveedor externo debe ser reemplazable.

## Regla 7

Toda excepción debe convertirse en error controlado en los bordes.

## Regla 8

Ninguna tool ejecuta cambios sin validación.

## Regla 9

Toda nueva decisión estructural requiere ADR.

## Regla 10

La IA no decide permisos; el backend decide permisos.
