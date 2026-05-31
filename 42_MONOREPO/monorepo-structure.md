# Monorepo Structure

## Objetivo
Definir la estructura base del repositorio real de AURION.

## Estructura recomendada
```txt
aurion-platform/
  apps/
    web/
    admin/
    voice-console/
    avatar-experience/
  services/
    api/
    voice-orchestrator/
    worker-runtime/
    memory-service/
    integration-gateway/
  packages/
    domain/
    application/
    contracts/
    ui/
    config/
    telemetry/
    testing/
  infrastructure/
    docker/
    compose/
    terraform/
    scripts/
  hermes/
    agents/
    skills/
    mcp/
    prompts/
  docs/
  tests/
    e2e/
    load/
    voice-simulations/
```

## Regla de boundaries
- `apps/*` no contienen lógica de dominio crítica.
- `services/*` exponen capacidades ejecutables.
- `packages/domain` no depende de frameworks.
- `packages/contracts` define DTOs, eventos y esquemas compartidos.
- `infrastructure/*` no debe filtrar secretos al repositorio.
- `hermes/*` contiene configuración y gobierno de agentes, no secretos.

## Decisión
El monorepo debe favorecer coherencia y velocidad sin romper límites de dominio.
