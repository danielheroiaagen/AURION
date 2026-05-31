---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Política de audit logs

## Objetivo

Registrar toda acción relevante para seguridad, soporte, cumplimiento y trazabilidad.

## Eventos auditables

- Login admin.
- Cambio de configuración.
- Carga de conocimiento.
- Ejecución de herramienta.
- Acceso a dato sensible.
- Escalado humano.
- Cambio de permisos.
- Error crítico.
- Despliegue.
- Migración.

## Campos mínimos

- `audit_event_id`.
- `tenant_id`.
- `actor_type`.
- `actor_id`.
- `action`.
- `resource_type`.
- `resource_id`.
- `risk_level`.
- `timestamp`.
- `correlation_id`.
- `result`.

## Reglas

- No guardar secretos.
- Minimizar datos personales.
- Mantener integridad.
- Permitir exportación para auditoría.
- Definir retención.
