# Estructura de carpetas Hermes

## Objetivo

Mantener Hermes ordenado, auditable y fácil de restaurar.

## Estructura propuesta

```txt
/opt/aurion/hermes/
├── data/                # volumen principal persistente
├── backups/             # copias comprimidas
├── exports/             # exportaciones manuales
├── logs/                # logs externos del servicio
├── playbooks/           # guías operativas
├── skills-reviewed/     # skills aprobadas para uso
├── skills-drafts/       # skills en revisión
├── mcp-configs/         # configuración MCP documentada
└── runbooks/            # procedimientos de operación
```

## Reglas

- `skills-drafts` nunca se carga en producción.
- `skills-reviewed` solo contiene skills revisadas.
- `mcp-configs` no contiene secretos.
- `backups` debe cifrarse si contiene memoria o configuración sensible.
