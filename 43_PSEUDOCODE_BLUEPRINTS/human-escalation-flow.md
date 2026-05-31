# Flujo de escalado humano

## Objetivo

Pasar a un humano cuando el agente no debe o no puede resolver.

## Actores

- Cliente
- Voice Agent
- Supervisor humano
- Queue Service
- CRM

## Entradas

- Motivo de escalado
- Resumen
- Cliente
- Prioridad

## Salidas

- Transferencia
- Callback
- Ticket escalado

## Flujo humano

1. Detectar condición de escalado.
2. Explicar al cliente.
3. Preparar resumen.
4. Buscar humano disponible.
5. Transferir o crear callback.
6. Registrar.

## Pseudocódigo

```txt
FUNC evaluar_escalado(intencion, estado):
    SI cliente_pide_humano:
        return ESCALAR
    SI riesgo_alto:
        return ESCALAR
    SI confianza_baja_repetida:
        return ESCALAR
    SI cliente_enfadado:
        return ESCALAR
    return CONTINUAR

FUNC escalar(sesion):
    resumen = generar_resumen_para_humano(sesion)
    humano = buscar_agente_disponible()
    SI humano.disponible:
        transferir_llamada(humano, resumen)
    SINO:
        crear_callback_o_ticket(resumen)
```

## Reglas

- Nunca pelear con el cliente.
- Escalar rápido si hay riesgo legal, médico, financiero o enfado severo.

## Tests de aceptación

- Solicitud explícita de humano escala.
- No hay humano: se crea callback.
