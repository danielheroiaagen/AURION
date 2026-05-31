# Flujo dashboard frontend

## Objetivo

Mostrar estado de AURION a usuarios internos o clientes.

## Actores

- Usuario dashboard
- Frontend
- Backend API
- Auth Service

## Entradas

- Sesión usuario
- Tenant
- Filtros

## Salidas

- Datos visuales
- Acciones permitidas

## Flujo humano

1. Autenticar.
2. Cargar tenant.
3. Pedir métricas.
4. Renderizar componentes.
5. Permitir acciones según rol.

## Pseudocódigo

```txt
AL abrir_dashboard(usuario):
    auth = validar_sesion(usuario)
    tenant = obtener_tenant(auth)
    permisos = obtener_permisos(usuario)
    metricas = api.get_metrics(tenant, filtros)
    render_dashboard(metricas, permisos)
```

## Reglas

- Frontend no decide seguridad final.
- Backend valida permisos siempre.

## Tests de aceptación

- Usuario sin permiso no ve datos sensibles.
