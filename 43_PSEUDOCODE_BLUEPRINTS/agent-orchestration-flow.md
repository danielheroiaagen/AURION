# Flujo de orquestación de agentes de producto

## Objetivo

Delegar tareas entre agentes runtime según intención.

## Actores

- Router Agent
- Voice Agent
- Action Agent
- RAG Agent
- Escalation Agent

## Entradas

- Intención
- Contexto
- Herramientas

## Salidas

- Agente seleccionado
- Resultado
- Escalado

## Flujo humano

1. Detectar intención.
2. Elegir agente especializado.
3. Pasar contexto mínimo.
4. Recibir resultado.
5. Validar respuesta final.

## Pseudocódigo

```txt
FUNC orquestar(intencion, contexto):
    SI intencion.tipo == "pregunta_conocimiento":
        return rag_agent.responder(intencion, contexto)
    SI intencion.tipo == "accion":
        return action_agent.ejecutar(intencion, contexto)
    SI intencion.tipo == "emocion_negativa" OR intencion.pide_humano:
        return escalation_agent.escalar(contexto)
    return voice_agent.conversar(intencion, contexto)
```

## Reglas

- Pasar solo contexto necesario.
- El router no ejecuta acciones directamente.

## Tests de aceptación

- Pregunta va a RAG.
- Acción va a Action Agent.
