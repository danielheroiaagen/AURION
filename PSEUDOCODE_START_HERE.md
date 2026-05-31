# PSEUDOCODE_START_HERE.md

## Propósito

Esta carpeta convierte AURION en una arquitectura comprensible en lenguaje humano. Antes de programar, cualquier IA debe leer el pseudocódigo para entender la lógica, los límites y el flujo del sistema.

## Qué es este pseudocódigo

No es código ejecutable. Es una descripción estructurada de cómo debe pensar y comportarse AURION.

Sirve para:

- Entender la lógica de producto antes del desarrollo.
- Evitar que la IA improvise.
- Traducir procesos empresariales a arquitectura Clean Architecture + Hexagonal.
- Diseñar tests antes de implementar.
- Validar flujos con clientes y stakeholders.

## Orden recomendado

1. `43_PSEUDOCODE_BLUEPRINTS/pseudocode-philosophy.md`
2. `43_PSEUDOCODE_BLUEPRINTS/full-system-flow.md`
3. `43_PSEUDOCODE_BLUEPRINTS/hexagonal-request-flow.md`
4. `43_PSEUDOCODE_BLUEPRINTS/voice-agent-session.md`
5. `43_PSEUDOCODE_BLUEPRINTS/action-execution-flow.md`
6. `43_PSEUDOCODE_BLUEPRINTS/tool-permission-flow.md`
7. `43_PSEUDOCODE_BLUEPRINTS/memory-write-flow.md`
8. `43_PSEUDOCODE_BLUEPRINTS/human-escalation-flow.md`
9. `43_PSEUDOCODE_BLUEPRINTS/hermes-worker-task-flow.md`
10. `43_PSEUDOCODE_BLUEPRINTS/end-to-end-scenario.md`

## Regla de oro

Si una funcionalidad no puede explicarse en pseudocódigo claro, todavía no está lista para programarse.
