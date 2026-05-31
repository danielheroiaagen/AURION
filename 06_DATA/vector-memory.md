---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Memoria vectorial

## Objetivo

Permitir que AURION recupere conocimiento relevante sin inventar y sin mezclar información entre empresas.

## Tipos de memoria

### Knowledge RAG

Documentos, FAQs, políticas y procesos de empresa.

### Customer Memory

Preferencias e historial útil del cliente, con base legal y retención.

### Conversation Memory

Contexto de la conversación activa.

### Agent Memory

Aprendizajes técnicos de los agentes internos.

## Reglas

- Toda memoria debe pertenecer a un tenant o ser global explícita.
- No mezclar tenants.
- No indexar secretos.
- No indexar datos sensibles sin necesidad.
- Versionar documentos.
- Guardar fuente y fecha.
- Permitir eliminación.

## Estrategia técnica

Primera opción: pgvector sobre PostgreSQL si el volumen inicial es razonable.

Opción de escala: Qdrant o vector DB dedicada.

## Evaluación

Se medirá:

- Precisión de recuperación.
- Alucinaciones.
- Fuentes erróneas.
- Tiempo de búsqueda.
- Cobertura de conocimiento.
