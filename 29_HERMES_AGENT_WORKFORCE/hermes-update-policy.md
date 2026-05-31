# Política de actualización Hermes

## Objetivo

Actualizar Hermes sin romper memoria, skills o flujos de trabajo.

## Flujo

```txt
1. Leer changelog.
2. Backup.
3. Actualizar staging.
4. Smoke tests.
5. Validar skills.
6. Validar MCP.
7. Actualizar producción.
8. Registrar versión.
```

## Nunca hacer

- Actualizar sin backup.
- Actualizar producción primero.
- Actualizar durante trabajo crítico.
- Cambiar modelo y versión a la vez sin prueba.

## Smoke tests

- Hermes responde.
- Lee documentación.
- No accede a rutas prohibidas.
- Ejecuta una tarea simple.
- Rechaza acción peligrosa.
