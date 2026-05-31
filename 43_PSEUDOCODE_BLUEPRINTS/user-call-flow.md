# Flujo de llamada de cliente

## Objetivo

Definir cómo se atiende una llamada telefónica desde entrada hasta cierre.

## Actores

- Cliente
- Proveedor SIP
- LiveKit/SIP
- Voice Agent
- Backend
- Supervisor humano

## Entradas

- Número entrante
- Audio del cliente
- Tenant asociado
- Horario de atención

## Salidas

- Conversación resuelta
- Ticket/cita/acción
- Escalado si procede
- Resumen

## Flujo humano

1. Entrar llamada por SIP.
2. Resolver tenant por número destino.
3. Crear sala/sesión realtime.
4. Saludar según configuración.
5. Escuchar intención.
6. Resolver o actuar.
7. Escalar si hay riesgo o petición humana.
8. Cerrar llamada con resumen claro.

## Pseudocódigo

```txt
AL recibir_llamada(numero_origen, numero_destino):
    tenant = buscar_tenant_por_numero(numero_destino)
    SI tenant.no_existe:
        reproducir_mensaje_generico()
        finalizar()

    sesion = iniciar_voice_session(tenant, numero_origen)
    cliente = identificar_cliente(numero_origen, tenant)
    saludo = construir_saludo(tenant, cliente)
    hablar(saludo)

    REPETIR hasta fin_llamada:
        audio = escuchar()
        texto = transcribir(audio)
        intencion = interpretar(texto)
        manejar_intencion(intencion, cliente, tenant)

    guardar_resumen_llamada(sesion)
```

## Reglas

- Nunca revelar datos hasta identificar al cliente.
- Permitir interrupciones naturales.
- No repetir menús IVR rígidos si se entiende la intención.

## Tests de aceptación

- Cliente conocido recibe saludo personalizado permitido.
- Cliente desconocido no accede a datos privados.
- La llamada se puede escalar a humano.
