# Flujo de tarea con Hermes Worker

## Objetivo

Definir cómo un agente Hermes trabaja una tarea interna.

## Actores

- Daniel/CEO
- Hermes Orchestrator
- Agente especializado
- Reviewer humano
- Repositorio

## Entradas

- Tarea
- Documentos
- Permisos
- Definition of Done

## Salidas

- Propuesta
- Cambios
- Tests
- Documentación
- PR

## Flujo humano

1. Recibir tarea.
2. Leer documentación.
3. Asignar agente.
4. Analizar impacto.
5. Proponer plan.
6. Ejecutar en rama o draft.
7. Probar.
8. Documentar.
9. Enviar revisión.

## Pseudocódigo

```txt
FUNC ejecutar_tarea_hermes(tarea):
    validar_definition_of_done(tarea)
    docs = cargar_contexto(tarea.context_docs)
    agente = seleccionar_agente(tarea.tipo)
    plan = agente.proponer_plan(tarea, docs)

    SI tarea.riesgo >= MEDIO:
        solicitar_aprobacion(plan)

    resultado = agente.ejecutar(plan, sandbox=True)
    tests = ejecutar_tests_relevantes(resultado)
    actualizar_documentacion(resultado)
    crear_resumen_revision(resultado, tests)
```

## Reglas

- Hermes no trabaja sin contexto.
- Riesgo medio/alto requiere aprobación.
- Toda salida debe ser revisable.

## Tests de aceptación

- Tarea sin DoD se bloquea.
- Tarea técnica incluye tests.
