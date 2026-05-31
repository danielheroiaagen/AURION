---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# MCP Servers

## Objetivo

Definir MCP servers permitidos para agentes internos.

## MCP iniciales

### filesystem

Acceso controlado a carpetas del proyecto.

Riesgo: medio.

Restricción: no acceder a secretos ni carpetas del sistema.

### github

Issues, PRs, ramas, revisión de código.

Riesgo: alto.

Restricción: no mergear sin aprobación.

### postgres-dev

Consulta de base de datos de desarrollo.

Riesgo: medio.

Restricción: no datos reales de clientes.

### docs-search

Búsqueda en documentación interna.

Riesgo: bajo.

### browser/research

Investigación técnica pública.

Riesgo: bajo/medio.

Debe citar fuentes cuando se use para decisiones.

## Reglas MCP

- Cada MCP debe tener permisos mínimos.
- Cada MCP debe estar documentado.
- Cada MCP con escritura debe auditarse.
- Ningún MCP debe exponer secretos en logs.
