---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Backups

## Objetivo

Proteger datos de AURION ante errores, ataques, corrupción o pérdida de infraestructura.

## Qué respaldar

- PostgreSQL.
- Object storage.
- Configuración crítica.
- Documentos de conocimiento.
- Audit logs.

## Frecuencia inicial

- Backup diario de base de datos.
- Backup antes de migraciones.
- Backup de configuración tras cambios críticos.

## Reglas

- Backups cifrados.
- Restauración probada periódicamente.
- Separación de credenciales.
- Retención definida.
- No confiar en backup no probado.

## Prueba de restauración

Debe validarse:

- Integridad.
- Tiempo de recuperación.
- Datos críticos.
- Permisos.
- Compatibilidad con migraciones.
