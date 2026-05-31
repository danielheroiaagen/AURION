# Plantilla de configuración MCP Hermes

## Plantilla conceptual

```yaml
mcp_servers:
  server_name:
    enabled: true
    command: "command"
    args: []
    env: {}
    timeout: 120
    connect_timeout: 60
    tools:
      include: []
      exclude: []
      resources: true
      prompts: true
```

## Checklist antes de activar MCP

- ¿Necesita realmente esta herramienta?
- ¿Puede funcionar en modo read-only?
- ¿Hay secrets en env?
- ¿Está limitado al repositorio correcto?
- ¿Se auditan llamadas?
- ¿Puede borrar o modificar datos?
- ¿Existe entorno staging?

## Regla

Un MCP no es “más poder para la IA”; es una interfaz de responsabilidad.
