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

## Decisión actual

El MVP sigue `ADR-007`: **JWT + tenant-scoped RBAC + Policy Guard**.

Eso significa algo MUY importante: un rol no alcanza por sí solo. Cada acción protegida debe responder:

1. ¿Quién es el actor?
2. ¿A qué `tenant_id` pertenece el recurso?
3. ¿Qué permiso pide?
4. ¿La acción requiere aprobación humana o auditoría?

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

## Matriz de permisos MVP

| Permiso | Platform Owner | Tenant Admin | Supervisor | Human Agent | Developer/Integrator | Auditor | Voice Agent |
|---------|----------------|--------------|------------|-------------|----------------------|---------|-------------|
| `tenant:read` | Sí | Sí, mismo tenant | Sí, mismo tenant | No | No | Sí, mismo tenant | No |
| `tenant:settings:update` | Sí | Sí, mismo tenant | No | No | Parcial | No | No |
| `user:read` | Sí | Sí, mismo tenant | Sí, mismo tenant | No | No | Sí, mismo tenant | No |
| `user:manage` | Sí | Sí, mismo tenant | No | No | No | No | No |
| `conversation:read` | Sí | Sí, mismo tenant | Sí, mismo tenant | Sí, asignadas | No | Sí, mismo tenant | Sí, contexto activo |
| `conversation:review` | Sí | Sí, mismo tenant | Sí, mismo tenant | No | No | Sí, lectura | No |
| `conversation:write` | Sí | Sí, mismo tenant | No | No | No | No | Sí, sesiones propias |
| `knowledge:read` | Sí | Sí, mismo tenant | Sí, mismo tenant | Sí, mismo tenant | No | Sí, mismo tenant | Sí, conocimiento publicado |
| `knowledge:write` | Sí | Sí, mismo tenant | No | No | Parcial | No | No |
| `tool:execute:calendar.update` | Sí | Sí, mismo tenant | No | No | No | No | Sí, si la policy lo permite |
| `tool:execute:ticket.create` | Sí | Sí, mismo tenant | Sí, mismo tenant | Sí, asignadas | No | No | Sí, si la policy lo permite |
| `action:read` | Sí | Sí, mismo tenant | Sí, mismo tenant | No | No | Sí, mismo tenant | Sí, acciones propias |
| `audit:read` | Sí | Sí, mismo tenant | Sí, mismo tenant | No | No | Sí, mismo tenant | No |
| `deployment:approve` | Sí | No | No | No | No | No | No |

## Acciones sensibles

Estas acciones no se autorizan solo por rol. Pasan por **Policy Guard**, requieren `tenant_id`, actor, recurso y motivo auditable:

- Cambiar configuración del tenant.
- Invitar usuarios o cambiar roles/estado de membresías (`user:manage`). Nadie modifica su propia membresía; `platform_owner` no es asignable vía API.
- Escribir o eliminar conocimiento de la base documental.
- Ejecutar tools que creen o modifiquen compromisos con clientes.
- Aprobar despliegues o cambios operativos.
- Actualizar credenciales de integraciones.
- Cambiar facturación, contratos, datos legales o retención.

## Reglas

- Todo permiso debe estar asociado a tenant.
- Todo recurso de cliente debe tener `tenant_id`.
- Los agentes IA no reciben permisos humanos completos.
- Las tools tienen permisos específicos.
- Acciones críticas requieren aprobación o doble validación.
- El sistema debe negar por defecto si falta actor, permiso, recurso o tenant.
- Las decisiones sensibles deben dejar rastro en auditoría.

## Ejemplos de permisos

- `conversation:read`
- `conversation:review`
- `tool:execute:calendar.update`
- `tool:execute:ticket.create`
- `knowledge:write`
- `tenant:settings:update`
- `audit:read`
- `deployment:approve`
