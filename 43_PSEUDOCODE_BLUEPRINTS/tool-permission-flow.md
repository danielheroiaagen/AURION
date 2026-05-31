# Flujo de permisos de herramientas

## Objetivo

Determinar si un agente puede usar una herramienta concreta.

## Actores

- Agent
- Permission Service
- Tenant Policy
- Audit Service

## Entradas

- Tool call solicitado
- Rol del agente
- Tenant
- Contexto

## Salidas

- Permitido
- Denegado
- Requiere aprobación

## Flujo humano

1. Identificar herramienta.
2. Identificar acción concreta.
3. Consultar política del tenant.
4. Clasificar riesgo.
5. Permitir, bloquear o pedir aprobación.
6. Auditar decisión.

## Pseudocódigo

```txt
FUNC validar_tool_call(tool_call, agente, tenant):
    politica = cargar_politica(tenant)
    riesgo = clasificar_tool(tool_call)
    permisos = obtener_permisos(agente.rol)

    SI tool_call.herramienta NO ESTA EN permisos:
        return DENEGADO

    SI riesgo == CRITICO:
        return REQUIERE_APROBACION_HUMANA

    SI politica.bloquea(tool_call):
        return DENEGADO

    return PERMITIDO
```

## Reglas

- Permiso por rol, no por capricho del agente.
- Producción tiene políticas más estrictas que staging.
- Toda denegación se registra.

## Tests de aceptación

- Agente documentación no puede borrar archivos.
- DevOps puede operar staging.
- Producción requiere aprobación.
