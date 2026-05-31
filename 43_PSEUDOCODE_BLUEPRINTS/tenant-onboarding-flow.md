# Flujo onboarding de tenant

## Objetivo

Crear una nueva empresa cliente en AURION.

## Actores

- Admin AURION
- Cliente empresa
- Tenant Service
- Billing
- Voice Config
- Knowledge Service

## Entradas

- Datos empresa
- Plan
- Canales
- Configuración inicial

## Salidas

- Tenant creado
- Admin invitado
- Configuración base

## Flujo humano

1. Crear tenant.
2. Crear usuario admin.
3. Asignar plan.
4. Configurar canales.
5. Cargar conocimiento inicial.
6. Probar llamada demo.
7. Activar.

## Pseudocódigo

```txt
FUNC onboarding_tenant(datos_empresa):
    tenant = crear_tenant(datos_empresa)
    admin = crear_admin_tenant(tenant)
    asignar_plan(tenant, datos_empresa.plan)
    configurar_voice_defaults(tenant)
    configurar_avatar_defaults(tenant)
    crear_espacio_conocimiento(tenant)
    enviar_invitacion(admin)
    return tenant
```

## Reglas

- Todo tenant debe tener aislamiento de datos.
- No activar producción sin checklist.

## Tests de aceptación

- Tenant tiene admin.
- Tenant tiene configuración voice base.
