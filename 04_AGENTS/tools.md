---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Herramientas de agentes

## Categorías

### Lectura

- Leer documentación.
- Leer código.
- Buscar en repositorio.
- Consultar issues.

### Escritura controlada

- Crear rama.
- Crear archivos.
- Modificar documentación.
- Proponer PR.

### Desarrollo

- Ejecutar tests.
- Ejecutar linter.
- Ejecutar typecheck.
- Generar migraciones en entorno local.

### Integraciones

- GitHub.
- Filesystem limitado.
- PostgreSQL dev.
- Logs dev.
- MCP servers.

### Prohibidas sin aprobación

- Acceso a producción.
- Borrado de datos.
- Rotación de secretos.
- Despliegue.
- Migración destructiva.
- Envío masivo de emails.

## Formato de registro de herramienta

Cada herramienta debe documentar:

- Nombre.
- Propósito.
- Inputs.
- Outputs.
- Riesgo.
- Permisos.
- Auditoría.
- Fallback.
