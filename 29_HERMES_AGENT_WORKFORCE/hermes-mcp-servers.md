# MCP Servers para Hermes

## Propósito

Definir servidores MCP seguros para que Hermes pueda interactuar con recursos externos.

## MCP permitidos inicialmente

- Filesystem limitado al repositorio AURION.
- GitHub para issues, PRs y repositorios.
- PostgreSQL read-only para entornos no productivos.
- Documentation search.
- Browser/search si está permitido.
- Linear/Notion opcional para gestión de tareas.

## MCP prohibidos por defecto

- Acceso root al VPS.
- Base de datos de producción con escritura.
- Secret managers con lectura de claves completas.
- Herramientas de borrado masivo.
- Shell sin sandbox.

## Configuración conceptual

```yaml
mcp_servers:
  aurion_filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/repo/AURION"]
    enabled: true
    tools:
      include: ["read_file", "list_directory", "search_files"]
      exclude: ["delete_file"]
```

## Regla de mínimos privilegios

Cada MCP debe exponer solo lo que el agente necesita para una tarea concreta.
