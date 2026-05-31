# Permisos de herramientas Hermes

## Objetivo

Controlar qué herramientas puede usar cada agente y bajo qué condiciones.

## Niveles de permiso

```txt
L0: lectura de documentación
L1: lectura de código
L2: generación de propuestas
L3: escritura en rama local
L4: creación de PR
L5: ejecución en staging
L6: producción con aprobación humana
```

## Política por defecto

Todos los agentes empiezan en L0/L1. Nadie obtiene escritura o ejecución sin justificación.

## Matriz resumida

| Rol | Lectura | Escritura | Shell | Producción |
|---|---:|---:|---:|---:|
| Documentation Agent | Sí | Draft | No | No |
| Backend Agent | Sí | Rama | Limitado | No |
| DevOps Agent | Sí | Infra draft | Staging | Aprobación |
| Security Agent | Sí | Reportes | Limitado | No |

## Regla

La herramienta más peligrosa siempre requiere más fricción, no menos.
