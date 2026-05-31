# Flujo de configuración de cliente

## Objetivo

Permitir que cada empresa configure voz, avatar, horarios, herramientas y políticas.

## Actores

- Admin cliente
- AURION Dashboard
- Config Service
- Policy Engine

## Entradas

- Preferencias
- Horarios
- Herramientas
- Permisos

## Salidas

- Configuración guardada
- Validación
- Vista previa

## Flujo humano

1. Editar configuración.
2. Validar reglas.
3. Guardar borrador.
4. Probar en sandbox.
5. Publicar versión.

## Pseudocódigo

```txt
FUNC actualizar_configuracion(tenant, cambios):
    validar_schema(cambios)
    riesgos = analizar_riesgos(cambios)
    SI riesgos.altos:
        requerir_aprobacion_admin()
    version = guardar_config_draft(tenant, cambios)
    ejecutar_sandbox_test(version)
    publicar_si_aprobado(version)
```

## Reglas

- Cambios de herramientas requieren prueba.
- Versionar configuración.

## Tests de aceptación

- Config inválida no se guarda.
- Publicación conserva versión anterior para rollback.
