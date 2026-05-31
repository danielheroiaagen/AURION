# Flujo de ejecución de acciones

## Objetivo

Definir cómo AURION ejecuta acciones reales sin perder control.

## Actores

- Voice Agent
- Action Router
- Permission Service
- Tool Adapter
- Audit Service
- Cliente

## Entradas

- Intención de acción
- Cliente
- Tenant
- Datos requeridos

## Salidas

- Acción completada
- Denegación
- Solicitud de confirmación
- Escalado

## Flujo humano

1. Clasificar acción.
2. Validar permisos.
3. Pedir datos faltantes.
4. Pedir confirmación si cambia datos.
5. Ejecutar adaptador.
6. Confirmar resultado.
7. Auditar.

## Pseudocódigo

```txt
FUNC ejecutar_accion(intencion, cliente, tenant):
    accion = mapear_intencion_a_accion(intencion)
    riesgo = calcular_riesgo(accion)

    SI riesgo == ALTO:
        solicitar_confirmacion_explicita(cliente)

    permiso = permission_service.validar(cliente, tenant, accion)
    SI permiso.denegado:
        audit("accion_denegada", accion)
        devolver_error_controlado()

    datos = recopilar_datos_necesarios(accion)
    resultado = tool_adapter.ejecutar(accion, datos)
    audit("accion_ejecutada", resultado)
    devolver(resultado)
```

## Reglas

- Acciones destructivas requieren aprobación humana.
- No ejecutar si faltan datos obligatorios.
- Confirmar antes de cambiar información importante.

## Tests de aceptación

- Cambio de cita pide confirmación.
- Consulta simple no pide confirmación extra.
- Error de adaptador genera mensaje claro.
