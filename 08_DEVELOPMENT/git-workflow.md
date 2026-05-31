---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Git Workflow

## Ramas

- `main`: producción estable.
- `develop`: integración.
- `feature/*`: nuevas funcionalidades.
- `fix/*`: correcciones.
- `docs/*`: documentación.
- `chore/*`: mantenimiento.

## Reglas

- No trabajar directo en main.
- PR obligatorio para cambios relevantes.
- Tests antes de merge.
- Revisión para arquitectura, seguridad o datos.
- Commits pequeños y claros.

## Para agentes IA

El agente debe crear cambios pequeños, explicar intención y evitar tocar archivos no relacionados.
