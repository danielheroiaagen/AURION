# Flujo de presencia avatar/holograma

## Objetivo

Definir cómo el avatar visual acompaña la conversación de voz.

## Actores

- Usuario
- Avatar UI
- Voice Session
- Avatar Provider
- Frontend
- Backend

## Entradas

- Audio del agente
- Texto/respuesta
- Estado emocional
- Configuración visual

## Salidas

- Avatar hablando
- Gestos
- Expresiones
- Sincronización labios

## Flujo humano

1. Crear sesión visual.
2. Sincronizar con sesión de voz.
3. Enviar audio/texto al avatar provider.
4. Mostrar expresión según intención.
5. Mantener coherencia entre voz y avatar.
6. Cerrar avatar al cerrar sesión.

## Pseudocódigo

```txt
AL iniciar_avatar_session(usuario, tenant):
    avatar_config = obtener_avatar_config(tenant)
    voice_session = asociar_sesion_voz(usuario)
    avatar_session = crear_avatar(avatar_config)

    CUANDO voice_agent.genera_respuesta(respuesta):
        emocion = detectar_tono(respuesta)
        enviar_a_avatar(respuesta.audio, respuesta.texto, emocion)
        renderizar_avatar()

    SI voice_session.finaliza:
        cerrar_avatar_session()
```

## Reglas

- El avatar no debe decir algo distinto a la voz.
- Si falla el avatar, la voz debe seguir funcionando.
- La identidad visual debe configurarse por tenant.

## Tests de aceptación

- Fallo de avatar no tumba llamada.
- El lipsync usa la respuesta correcta.
- El cierre libera recursos.
