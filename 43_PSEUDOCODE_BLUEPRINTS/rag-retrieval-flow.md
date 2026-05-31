# Flujo de recuperación RAG

## Objetivo

Buscar conocimiento relevante sin inventar respuestas.

## Actores

- Agent
- RAG Service
- Vector Store
- PostgreSQL
- Knowledge Base

## Entradas

- Pregunta
- Tenant
- Permisos
- Contexto

## Salidas

- Fragmentos relevantes
- Respuesta fundamentada
- Escalado si no hay datos

## Flujo humano

1. Normalizar pregunta.
2. Aplicar filtros de tenant y permisos.
3. Buscar en vector store.
4. Reordenar resultados.
5. Verificar suficiencia.
6. Responder o escalar.

## Pseudocódigo

```txt
FUNC responder_con_rag(pregunta, tenant, cliente):
    filtros = construir_filtros(tenant, cliente.permisos)
    candidatos = vector_store.search(pregunta, filtros)
    fragmentos = rerank(candidatos)

    SI fragmentos.vacios or confianza_baja(fragmentos):
        return "No tengo información suficiente; puedo escalarlo."

    respuesta = generar_respuesta(fragmentos)
    incluir_limites(respuesta)
    return respuesta
```

## Reglas

- Nunca mezclar documentos de tenants.
- No inventar si no hay fuente.
- Citar o referenciar internamente el origen.

## Tests de aceptación

- Pregunta con documento existente responde.
- Pregunta sin fuente escala.
- Tenant A no ve datos de Tenant B.
