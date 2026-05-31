# Flujo de guardrails de seguridad

## Objetivo

Bloquear respuestas o acciones inseguras.

## Actores

- Agent
- Guardrail Service
- Policy Engine
- Human Reviewer

## Entradas

- Respuesta o acción propuesta
- Contexto
- Política

## Salidas

- Permitido
- Bloqueado
- Escalado

## Flujo humano

1. Clasificar riesgo.
2. Aplicar política.
3. Modificar respuesta si procede.
4. Bloquear acción peligrosa.
5. Escalar si necesario.

## Pseudocódigo

```txt
FUNC aplicar_guardrail(output):
    riesgos = detectar_riesgos(output)
    SI riesgos.contiene("secreto"):
        return BLOQUEAR
    SI riesgos.contiene("accion_critica"):
        return REQUIERE_APROBACION
    SI riesgos.contiene("dato_sensible"):
        return REDACTAR
    return PERMITIR
```

## Reglas

- Bloquear antes de ejecutar, no después.
- Redactar datos sensibles.

## Tests de aceptación

- Output con secreto se bloquea.
- Acción crítica pide aprobación.
