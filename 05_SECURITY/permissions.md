---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Permisos y RBAC

## Roles principales

### Platform Owner

Control completo interno de AURION.

### Tenant Admin

Administra una empresa cliente.

### Supervisor

Revisa conversaciones, métricas y calidad.

### Human Agent

Atiende escalados.

### Developer/Integrator

Configura integraciones técnicas.

### Auditor

Acceso de lectura a auditoría.

### Voice Agent

Actor máquina con permisos restringidos.

## Reglas

- Todo permiso debe estar asociado a tenant.
- Los agentes IA no reciben permisos humanos completos.
- Las tools tienen permisos específicos.
- Acciones críticas requieren aprobación o doble validación.

## Ejemplos de permisos

- `conversation:read`
- `conversation:review`
- `tool:execute:calendar.update`
- `tool:execute:ticket.create`
- `knowledge:write`
- `tenant:settings:update`
- `audit:read`
- `deployment:approve`
