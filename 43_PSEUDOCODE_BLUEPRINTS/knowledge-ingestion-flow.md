# Flujo de ingesta de conocimiento

## Objetivo

Convertir documentos de cliente en conocimiento usable por agentes.

## Actores

- Admin cliente
- Knowledge Service
- Parser
- Embedding Service
- Vector Store
- Reviewer

## Entradas

- PDF/URL/Markdown/FAQ
- Tenant
- Permisos

## Salidas

- Documento procesado
- Chunks
- Embeddings
- Estado aprobado

## Flujo humano

1. Subir documento.
2. Validar tipo y tenant.
3. Extraer texto.
4. Dividir en chunks.
5. Generar embeddings.
6. Guardar metadatos.
7. Marcar pendiente de revisión o activo.

## Pseudocódigo

```txt
FUNC ingerir_documento(file, tenant):
    validar_formato(file)
    texto = extraer_texto(file)
    chunks = dividir(texto, estrategia="semantic")
    PARA chunk EN chunks:
        embedding = generar_embedding(chunk)
        vector_store.upsert(tenant, chunk, embedding)
    registrar_documento(tenant, file, estado="pending_review")
```

## Reglas

- Cada chunk debe incluir tenant_id.
- No activar documentos sin revisión si son críticos.

## Tests de aceptación

- Documento inválido se rechaza.
- Chunks quedan filtrables por tenant.
