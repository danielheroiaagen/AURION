---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Estructura de carpetas recomendada

```txt
AURION/
├── apps/
│   ├── web/
│   ├── api/
│   └── voice-runtime/
├── services/
│   ├── memory-service/
│   ├── action-fabric/
│   ├── avatar-service/
│   └── evaluation-service/
├── packages/
│   ├── domain/
│   ├── application/
│   ├── ports/
│   ├── shared/
│   └── config/
├── infrastructure/
│   ├── docker/
│   ├── postgres/
│   ├── redis/
│   └── observability/
├── hermes/
│   ├── agents/
│   ├── skills/
│   └── mcp/
├── docs/
└── tests/
```

## Regla

La estructura puede evolucionar, pero no puede romper la separación entre dominio, aplicación, puertos, adaptadores e infraestructura.
