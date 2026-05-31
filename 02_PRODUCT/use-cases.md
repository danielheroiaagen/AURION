---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Casos de uso

## UC-001 — Atención telefónica general

El cliente llama, AURION identifica la empresa, saluda, detecta intención, consulta conocimiento, resuelve o escala.

### Resultado esperado

Conversación registrada, resumen generado y estado final claro.

## UC-002 — Cambio de cita

El cliente solicita cambiar una cita. AURION verifica identidad, consulta disponibilidad, propone horarios, confirma y actualiza calendario.

### Herramientas

- Calendar Tool.
- Customer Profile Tool.
- Audit Log Tool.

## UC-003 — Creación de ticket de soporte

El cliente reporta una incidencia. AURION recopila datos, clasifica prioridad, crea ticket y comunica número de seguimiento.

## UC-004 — Consulta de pedido

AURION verifica datos mínimos, consulta sistema de pedidos y comunica estado actualizado.

## UC-005 — Recepción virtual con avatar

Un visitante entra en la web o en una pantalla física y habla con un avatar que guía, responde y deriva.

## UC-006 — Escalado humano

Cuando hay baja confianza, enfado, riesgo legal, datos inconsistentes o petición sensible, AURION transfiere a humano con resumen.

## UC-007 — Actualización de base de datos

AURION modifica un registro solo si la herramienta está autorizada, la identidad se validó y la acción tiene bajo riesgo o aprobación.

## UC-008 — Agente interno de desarrollo

Hermes Agent recibe tarea, consulta documentación, crea propuesta técnica, genera rama, escribe tests y solicita revisión.

## UC-009 — Auditoría de calidad

Supervisor filtra conversaciones con baja satisfacción o error y revisa transcripción, audio, herramientas ejecutadas y decisión de escalado.
