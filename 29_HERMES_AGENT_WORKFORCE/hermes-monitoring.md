# Monitorización Hermes

## Objetivo

Detectar fallos antes de que afecten al desarrollo.

## Métricas

- Estado del contenedor.
- Uso de CPU/RAM.
- Errores del gateway.
- Latencia de respuesta.
- Fallos de modelo.
- Fallos MCP.
- Número de tool calls bloqueados.
- Tamaño de logs.
- Antigüedad del último backup.

## Alertas mínimas

- Contenedor caído.
- Reinicios repetidos.
- Disco > 80%.
- Gateway expuesto públicamente sin protección.
- Backup fallido.
- Uso anómalo de herramientas.
