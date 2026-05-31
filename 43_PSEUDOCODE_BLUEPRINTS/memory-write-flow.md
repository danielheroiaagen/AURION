# Flujo de escritura de memoria

## Objetivo

Definir cuándo se puede guardar memoria y dónde.

## Actores

- Agent
- Memory Service
- Privacy Guard
- Audit Service

## Entradas

- Aprendizaje detectado
- Contexto
- Tipo de memoria

## Salidas

- Memoria guardada
- Memoria rechazada
- Resumen actualizado

## Flujo humano

1. Detectar posible aprendizaje.
2. Evaluar utilidad futura.
3. Evaluar sensibilidad.
4. Seleccionar memoria correcta.
5. Guardar resumen mínimo.
6. Auditar.

## Pseudocódigo

```txt
FUNC guardar_memoria(candidato):
    SI no_es_util_a_futuro(candidato):
        return RECHAZAR

    sensibilidad = clasificar_sensibilidad(candidato)
    SI sensibilidad == SECRETO or sensibilidad == DATO_CLIENTE_SENSIBLE:
        return RECHAZAR

    destino = seleccionar_memoria(candidato)
    resumen = compactar(candidato)
    memory_store.add(destino, resumen)
    audit("memory_write", destino)
```

## Reglas

- No guardar secretos.
- No guardar datos sensibles de clientes en memoria de agente.
- Guardar frases cortas y accionables.

## Tests de aceptación

- API key se rechaza.
- Preferencia técnica se guarda.
- Dato sensible de cliente se rechaza.
