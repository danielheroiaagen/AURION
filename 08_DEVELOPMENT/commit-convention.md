---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Convención de commits

Usar Conventional Commits.

## Tipos

- `feat:` nueva funcionalidad.
- `fix:` corrección.
- `docs:` documentación.
- `test:` tests.
- `refactor:` refactor sin cambio funcional.
- `chore:` mantenimiento.
- `security:` cambio de seguridad.
- `infra:` infraestructura.

## Ejemplos

```txt
feat(voice): add voice session domain entity
fix(memory): prevent cross-tenant retrieval
docs(architecture): add ADR for PostgreSQL
security(tools): require approval for high-risk actions
```
