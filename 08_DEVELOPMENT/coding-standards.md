---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Coding Standards

## Lenguaje

TypeScript estricto para frontend/backend Node.

Python tipado para workers si se usan.

## Principios

- Código claro sobre código listo.
- Nombres explícitos.
- Funciones pequeñas.
- Errores tipados.
- Validación en bordes.
- Tests cerca del comportamiento.

## TypeScript

- `strict: true`.
- Evitar `any`.
- DTOs validados.
- Tipos de dominio separados de tipos de infraestructura.

## Backend

- Controllers finos.
- Use cases explícitos.
- Repositorios detrás de interfaces.
- Adaptadores aislados.

## Frontend

- Componentes presentacionales separados de lógica.
- Accesibilidad.
- Estados de carga/error/vacío.
- No mezclar llamadas API por todas partes.

## Commits

Usar Conventional Commits.
