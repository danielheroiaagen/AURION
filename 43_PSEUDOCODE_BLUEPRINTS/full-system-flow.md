# Flujo completo del sistema AURION

## Objetivo

Describir cómo AURION recibe una interacción, entiende al usuario, consulta memoria, ejecuta acciones y registra el resultado.

## Actores

- Cliente final
- Voice Agent
- Avatar Agent
- Backend AURION
- Action Fabric
- Memory Graph
- Supervisor humano
- Hermes Workforce

## Entradas

- Llamada, chat o sesión avatar
- Configuración del tenant
- Historial del cliente
- Permisos de herramientas

## Salidas

- Respuesta al cliente
- Acción ejecutada o escalada
- Resumen
- Auditoría
- Métricas

## Flujo humano

1. Recibir interacción desde canal soportado.
2. Identificar tenant y contexto.
3. Crear sesión realtime.
4. Entender intención.
5. Consultar conocimiento y memoria permitida.
6. Decidir si responder, actuar o escalar.
7. Validar permisos antes de cualquier acción.
8. Ejecutar herramienta si procede.
9. Confirmar resultado al cliente.
10. Guardar resumen, auditoría y métricas.

## Pseudocódigo

```txt
CUANDO llega_interaccion(input):
    tenant = identificar_tenant(input.canal, input.numero, input.host)
    sesion = crear_sesion_realtime(tenant, input)
    contexto = cargar_contexto_permitido(tenant, input.cliente)

    MIENTRAS sesion.esta_activa:
        mensaje = escuchar_usuario()
        intencion = detectar_intencion(mensaje, contexto)
        riesgo = clasificar_riesgo(intencion)

        SI intencion.requiere_accion:
            permiso = validar_permiso(tenant, intencion.accion, cliente)
            SI permiso.denegado:
                responder("No puedo hacer esa acción directamente.")
                escalar_si_necesario()
            SI permiso.aprobado:
                resultado = ejecutar_accion_controlada(intencion)
                auditar(resultado)
                responder_confirmacion(resultado)
        SINO:
            respuesta = generar_respuesta_con_conocimiento(intencion, contexto)
            responder(respuesta)

    resumen = generar_resumen_sesion(sesion)
    guardar_resumen(resumen)
    enviar_metricas(sesion)
```

## Reglas

- Toda acción debe pasar por permisos.
- No se usa memoria sensible sin consentimiento.
- La sesión realtime no depende de Hermes.
- Hermes analiza después, no bloquea la llamada.

## Tests de aceptación

- Una llamada simple se responde sin acción externa.
- Una acción crítica pide confirmación.
- Un fallo de herramienta se comunica y se escala.
- Toda sesión genera resumen auditable.
