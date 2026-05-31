# Flujo consola de administración

## Objetivo

Gestionar tenants, herramientas, agentes y configuración.

## Actores

- Admin AURION
- Admin Cliente
- Backend
- Policy Engine

## Entradas

- Configuración
- Rol usuario
- Tenant

## Salidas

- Cambios versionados
- Auditoría

## Flujo humano

1. Validar rol.
2. Mostrar secciones permitidas.
3. Editar configuración.
4. Validar impacto.
5. Guardar versión.
6. Auditar.

## Pseudocódigo

```txt
FUNC guardar_config_admin(usuario, cambios):
    validar_rol(usuario)
    validar_cambios(changes= cambios)
    version = crear_version_config(changes)
    audit("config_changed", usuario, version)
    return version
```

## Reglas

- Cambios críticos requieren doble confirmación.
- Toda config es versionada.

## Tests de aceptación

- Admin cliente no puede tocar otro tenant.
