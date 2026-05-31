---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# North Star Metric

## Métrica principal

La métrica principal de AURION será:

> Conversaciones empresariales resueltas correctamente sin intervención humana y con satisfacción validada.

## Fórmula base

Conversaciones resueltas correctamente = conversaciones cerradas con intención cumplida, acción ejecutada, sin error crítico, sin alucinación y sin escalado innecesario.

## Métricas auxiliares

- Porcentaje de resolución autónoma.
- Tiempo medio de resolución.
- Latencia media de respuesta de voz.
- Tasa de escalado a humano.
- Tasa de acciones ejecutadas con éxito.
- Nivel de satisfacción del cliente.
- Coste por conversación.
- Porcentaje de llamadas con contexto recuperado correctamente.
- Porcentaje de llamadas auditadas sin incidencias.

## Qué NO debe optimizarse en solitario

No se debe optimizar únicamente el número de llamadas atendidas. Atender mucho y resolver mal destruye confianza.

No se debe optimizar únicamente reducción de costes. AURION debe aumentar calidad, velocidad y trazabilidad.

No se debe optimizar únicamente autonomía. Algunas situaciones deben escalarse a humano.

## Criterio de éxito inicial

AURION será considerado valioso cuando pueda resolver casos repetitivos de alto volumen con seguridad, trazabilidad y experiencia superior al IVR tradicional.
