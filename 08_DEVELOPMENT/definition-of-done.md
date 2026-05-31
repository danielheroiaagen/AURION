---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Definition of Done

Una tarea está terminada solo si:

- Cumple requisito del PRD o issue.
- Respeta arquitectura.
- Tiene tests adecuados.
- Pasa lint/typecheck.
- No introduce secretos.
- Respeta multi-tenant.
- Tiene auditoría si ejecuta acciones.
- Tiene logs útiles.
- Actualiza documentación.
- Tiene rollback si afecta infraestructura/datos.

## Para agentes IA

No declarar una tarea terminada sin listar validaciones realizadas.
