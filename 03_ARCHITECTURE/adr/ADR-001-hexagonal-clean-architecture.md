---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# ADR-001 — Usar arquitectura hexagonal y Clean Architecture

## Estado

Aceptado.

## Contexto

AURION integrará proveedores de voz, avatar, telefonía, bases de datos, memoria, CRMs y agentes internos. Si el dominio queda acoplado a frameworks o proveedores, el sistema será frágil.

## Decisión

Se usará arquitectura hexagonal combinada con Clean Architecture.

## Consecuencias positivas

- Dominio independiente.
- Adaptadores reemplazables.
- Tests más fáciles.
- Menor dependencia de proveedores.
- Mayor claridad para agentes IA.

## Consecuencias negativas

- Más estructura inicial.
- Más disciplina.
- Más archivos.

## Regla

Ningún proveedor externo puede ser importado desde dominio o casos de uso.
