# Workflow de desarrollo con Hermes

## Objetivo

Integrar Hermes al desarrollo sin perder control técnico.

## Flujo

```txt
1. Leer documentación relevante.
2. Crear análisis corto.
3. Proponer cambios.
4. Esperar aprobación si el cambio es grande.
5. Implementar en rama.
6. Ejecutar tests.
7. Actualizar documentación.
8. Crear resumen de PR.
9. Solicitar revisión.
```

## Prohibiciones

- No editar varias capas sin explicar impacto.
- No introducir dependencias sin ADR.
- No crear patrones nuevos si existe uno oficial.
- No saltarse Clean Architecture.
- No acceder directamente a PostgreSQL desde controladores.

## Regla Clean Architecture

Los agentes deben respetar siempre:

```txt
Controllers → Use Cases → Domain → Ports → Adapters
```
