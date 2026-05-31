---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Kubernetes futuro

## Estado

No obligatorio en fase inicial.

## Cuándo considerarlo

- Alto volumen de llamadas.
- Necesidad de escalado horizontal automático.
- Múltiples regiones.
- Separación avanzada de workloads.
- SLA empresarial.

## Componentes candidatos

- API.
- Voice Runtime.
- Workers.
- Memory Service.
- Evaluation Service.
- Observabilidad.

## Riesgo

Kubernetes añade complejidad. No se incorporará hasta que Docker Compose y arquitectura de servicios estén maduros.
