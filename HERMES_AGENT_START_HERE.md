# HERMES_AGENT_START_HERE.md

## Propósito

Este archivo es la entrada obligatoria para cualquier IA, agente Hermes, asistente de código o colaborador humano que vaya a trabajar con Hermes Agent dentro de AURION.

Hermes Agent no es el motor de llamadas en tiempo real de AURION. Hermes Agent es la **fuerza laboral IA interna**: agentes trabajadores con memoria, skills, herramientas, MCP y flujos de mejora controlada.

## Orden obligatorio de lectura

1. `29_HERMES_AGENT_WORKFORCE/hermes-role-in-aurion.md`
2. `29_HERMES_AGENT_WORKFORCE/hermes-vps-hostinger-deployment.md`
3. `29_HERMES_AGENT_WORKFORCE/hermes-agent-roles.md`
4. `29_HERMES_AGENT_WORKFORCE/hermes-skills-lifecycle.md`
5. `29_HERMES_AGENT_WORKFORCE/hermes-mcp-servers.md`
6. `29_HERMES_AGENT_WORKFORCE/hermes-security-boundaries.md`
7. `29_HERMES_AGENT_WORKFORCE/hermes-self-improvement-governance.md`
8. `43_PSEUDOCODE_BLUEPRINTS/hermes-worker-task-flow.md`
9. `43_PSEUDOCODE_BLUEPRINTS/hermes-skill-improvement-flow.md`
10. `08_DEVELOPMENT/agent.md`

## Regla ejecutiva

Hermes puede ayudar a diseñar, investigar, revisar, documentar, generar propuestas, crear skills y automatizar tareas internas. Hermes no puede modificar producción, tocar datos reales de clientes ni ejecutar comandos destructivos sin autorización humana y trazabilidad.

## Responsabilidades principales

- Mantener documentación viva.
- Revisar arquitectura antes de implementar.
- Proponer mejoras de producto.
- Generar tareas técnicas.
- Ayudar a crear PRDs, ADRs, tests, runbooks y prompts.
- Investigar integraciones.
- Crear skills reutilizables.
- Trabajar con MCP bajo permisos mínimos.

## Prohibiciones

- No usar Hermes como reemplazo directo de OpenAI Realtime en llamadas de baja latencia.
- No permitir ejecución de comandos sin guardrails.
- No guardar secretos en documentación.
- No mezclar memoria de clientes con memoria del agente.
- No desplegar cambios sin pipeline, tests y aprobación.
