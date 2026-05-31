# Sesión de Voice Agent realtime

## Objetivo

Definir la lógica interna de una sesión de voz baja latencia.

## Actores

- Voice Agent
- Realtime Model
- Tool Router
- Memory Service
- Audit Service

## Entradas

- Audio entrante
- Estado de sesión
- Herramientas disponibles
- Guardrails

## Salidas

- Audio respuesta
- Tool calls
- Eventos de sesión
- Resumen

## Flujo humano

1. Inicializar sesión.
2. Configurar instrucciones del tenant.
3. Activar turn detection.
4. Escuchar audio.
5. Responder con baja latencia.
6. Llamar herramientas cuando sea necesario.
7. Actualizar estado de sesión.

## Pseudocódigo

```txt
INICIAR voice_session(tenant, cliente):
    instrucciones = cargar_instrucciones_tenant(tenant)
    herramientas = cargar_herramientas_permitidas(tenant)
    estado = crear_estado_conversacion()

    CONFIGURAR realtime_model con:
        voz = tenant.voz
        instrucciones = instrucciones
        herramientas = herramientas
        guardrails = tenant.guardrails

    MIENTRAS conectado:
        evento = recibir_evento_audio()
        SI usuario_interrumpe:
            detener_respuesta_actual()
        SI modelo_solicita_tool:
            resultado = route_tool_call(evento.tool_call)
            enviar_resultado_al_modelo(resultado)
        SI modelo_responde_audio:
            reproducir_audio(evento.audio)
```

## Reglas

- La latencia manda: no meter procesos lentos en el loop crítico.
- Las herramientas lentas deben ser asíncronas o tener fallback.
- Cada tool call debe auditarse.

## Tests de aceptación

- Interrupción del usuario corta la respuesta.
- Tool call no autorizado se bloquea.
- La sesión puede continuar tras error no crítico.
