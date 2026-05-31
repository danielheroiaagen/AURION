# Flujo de observabilidad

## Objetivo

Medir salud técnica y calidad de conversación.

## Actores

- Runtime
- Metrics Service
- Tracing
- Logging
- Alerting

## Entradas

- Eventos
- Latencias
- Errores
- Costes

## Salidas

- Métricas
- Trazas
- Alertas
- Dashboard

## Flujo humano

1. Instrumentar sesión.
2. Medir latencia.
3. Registrar errores.
4. Crear trazas por tool call.
5. Emitir alertas si supera umbral.

## Pseudocódigo

```txt
AL iniciar_sesion:
    trace_id = crear_trace()
    medir("session.started")

AL tool_call:
    medir_latencia(tool_call)
    log_resultado(tool_call)

SI error_rate > umbral:
    alertar_sre()
```

## Reglas

- Cada llamada debe tener trace_id.
- No registrar PII sin redacción.

## Tests de aceptación

- Error genera alerta.
- Tool call tiene latencia medida.
