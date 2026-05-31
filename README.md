---
project: AURION
status: draft-v3-hermes-pseudocode
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance + Enterprise Documentation
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# AURION — Paquete documental maestro completo

Este repositorio contiene la documentación ampliada para construir **AURION**, una plataforma empresarial de asistentes virtuales de voz omniscientes, IVR inteligente, acciones realtime, memoria gobernada, telepresencia/avatar holográfico y fuerza laboral IA con Hermes Agent.

La documentación está diseñada para que una IA de desarrollo, Hermes Agent, Claude Code, Codex, Cursor, Windsurf o cualquier sistema multiagente trabaje con precisión y no actúe como un caballo desbocado.

## Estado actual

| Campo | Valor |
|-------|-------|
| Versión documental | `draft-v3-hermes-pseudocode` |
| MVP inicial | Voice Agent SaaS Core |
| Repositorio | Preparado para Git/GitHub desde Fase 0 |
| Archivos registrados | 504 archivos en `MANIFEST.json` |

El primer objetivo no es construir todo AURION a la vez. El primer objetivo es validar un núcleo profesional: agente de voz SaaS multi-tenant, conocimiento, una acción controlada, auditoría, métricas y pruebas críticas.

## Regla principal

> Ningún agente escribe código, diseña pantallas, crea campañas, toca bases de datos o modifica infraestructura sin leer primero los documentos relevantes.

## Stack base asumido

- **Frontend:** Next.js + React + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend:** arquitectura hexagonal + Clean Architecture.
- **Base de datos principal:** PostgreSQL.
- **Realtime voice:** OpenAI Realtime / Voice Agents, WebRTC, SIP y LiveKit.
- **Telepresencia:** LiveAvatar, HeyGen o capa propia WebXR/Three.js.
- **Agentes internos:** Hermes Agent en VPS Hostinger con Docker.
- **Memoria semántica:** pgvector o Qdrant.
- **Estado realtime:** Redis.
- **Eventos:** NATS/Kafka/cola equivalente según fase.
- **Observabilidad:** OpenTelemetry, métricas, logs y trazas por conversación.

## Orden recomendado para agentes IA

1. `AI_AGENT_START_HERE.md`
2. `DOCUMENTATION_MAP.md`
3. `00_GOVERNANCE/vision.md`
4. `00_GOVERNANCE/company-principles.md`
5. `02_PRODUCT/prd.md`
6. `03_ARCHITECTURE/architecture.md`
7. `08_DEVELOPMENT/agent.md`
8. `18_FRONTEND/frontend-architecture.md`
9. `19_BACKEND/hexagonal-clean-architecture-guide.md`
10. `20_DESIGN_SYSTEM/brand-strategy.md`
11. `22_MARKETING/marketing-strategy.md`
12. `27_VOICE_IVR/voice-product-spec.md`
13. `29_HERMES_AGENT_WORKFORCE/hermes-agents-catalog.md`
14. `37_CHECKLISTS/pre-coding-checklist.md`

## Áreas incluidas

- `18_FRONTEND/` — Documentación del frontend empresarial: Next.js, React, TypeScript, Tailwind, shadcn/ui, consola de voz, dashboard, avatar y panel SaaS multi-tenant.
- `19_BACKEND/` — Documentación del backend con arquitectura hexagonal, Clean Architecture, PostgreSQL, eventos, APIs, permisos, multi-tenant y herramientas de acción empresarial.
- `20_DESIGN_SYSTEM/` — Sistema de diseño, identidad visual, tokens, componentes, experiencia de voz/avatar, accesibilidad y coherencia premium de marca.
- `21_UX_RESEARCH/` — Investigación UX, journeys, blueprints de servicio, arquitectura de información, pruebas de usabilidad y experiencia de llamada.
- `22_MARKETING/` — Estrategia de marketing: posicionamiento, ICP, mensajes, SEO, contenidos, lanzamiento, lead magnets y voz de marca.
- `23_SALES/` — Estrategia comercial: inbound, outbound, discovery, demo, objeciones, propuestas, CRM, pipeline y venta enterprise.
- `24_CUSTOMER_SUCCESS/` — Customer success: onboarding, implementación, formación, QBR, health score, renovaciones, expansión, soporte y adopción.
- `25_PRODUCT_MANAGEMENT/` — Gestión de producto: operating model, roadmap, priorización, releases, analítica, experimentos, historias y criterios de aceptación.
- `26_PROJECT_MANAGEMENT/` — Gestión del proyecto: charter, ejecución, hitos, riesgos, decisiones, reuniones, stakeholders, RACI, sprints y documentación.
- `27_VOICE_IVR/` — Especificaciones del core de voz e IVR inteligente: llamadas, SIP, LiveKit, latencia, interrupciones, herramientas y handoff humano.
- `28_AVATAR_METAVERSE/` — Telepresencia, avatar, holograma virtual, LiveAvatar/HeyGen, lipsync, WebXR, entorno 3D, ética y testing.
- `29_HERMES_AGENT_WORKFORCE/` — Hermes Agent como fuerza laboral IA: despliegue, catálogo de agentes, skills, MCP, memoria, kanban, revisión y seguridad.
- `30_AI_ENGINEERING/` — Ingeniería de IA: prompts, tool calling, RAG, routing, guardrails, evaluación, simulación conversacional y política de fine-tuning.
- `31_INTEGRATIONS/` — Integraciones empresariales: CRM, calendarios, email, tickets, pagos, ERP, webhooks, MCP y gestión de API keys.
- `32_API_REFERENCE/` — Referencia interna de APIs: auth, tenants, agents, calls, tools, memory, webhooks y errores.
- `33_DB_DETAILED/` — PostgreSQL avanzado: estándares, tenancy, entidades, índices, transacciones, RLS, auditoría, migraciones y calidad de datos.
- `34_DEVOPS_SRE/` — DevOps y SRE: desarrollo local, VPS Hostinger, Docker Compose, secretos, monitorización, incidentes, backups y escalado.
- `35_LEGAL_FINANCE/` — Legal y finanzas: términos, privacidad, DPA, AI Act readiness, pricing, unit economics, costes y cuestionario de procurement.
- `36_TEMPLATES/` — Plantillas reutilizables para PRD, ADR, API specs, historias, tests, incidentes, propuestas, implementación y skills.
- `37_CHECKLISTS/` — Checklists obligatorios para codificación, arquitectura, seguridad, lanzamiento, onboarding, frontend, backend, voz, avatar y marketing.
- `38_PROMPTS/` — Prompts maestros para agentes especializados: general, frontend, backend, diseño, marketing, ventas, QA, seguridad y DevOps.
- `39_COMPANY_STRATEGY/` — Estrategia empresarial: moat, contratación, principios operativos, narrativa para inversores y plan a tres años.
- `40_ENTERPRISE_READINESS/` — Preparación enterprise: seguridad, procurement, SOC 2, ISO 27001, vendor risk y residencia de datos.
- `41_SECTOR_PLAYBOOKS_ADVANCED/` — Playbooks por sector con casos de uso, procesos, argumentos de venta y configuración de agentes.
- `42_MONOREPO/` — Monorepo: estructura, boundaries, librerías compartidas, versionado, build system y política de dependencias.

## Convención

- Todo documento está en Markdown.
- Todo documento tiene objetivo, alcance, reglas, entregables y checklist.
- Toda decisión técnica relevante debe convertirse en ADR.
- Todo cambio funcional debe actualizar PRD, arquitectura, testing y changelog.
- Todo cambio comercial debe actualizar marketing, ventas o customer success.
- Todo cambio visual debe actualizar diseño y frontend.

## Tamaño del paquete

- Archivos totales: 504
- Versión: `draft-v3-hermes-pseudocode`


---

# Actualización V3 — Hermes Agent profundo + pseudocódigo humano

Esta versión añade una capa específica para controlar la fuerza laboral IA basada en Hermes Agent y una capa de pseudocódigo para entender AURION antes de programar.

## Nuevos archivos raíz

- `HERMES_AGENT_START_HERE.md`
- `PSEUDOCODE_START_HERE.md`

## Carpeta reforzada

- `29_HERMES_AGENT_WORKFORCE/`

Ahora contiene documentación profunda sobre despliegue, VPS Hostinger, Docker, memoria, skills, MCP, seguridad, roles, prompts, runbooks, backups y automejora controlada.

## Nueva carpeta

- `43_PSEUDOCODE_BLUEPRINTS/`

Incluye flujos de lógica humana para llamadas, voz realtime, avatar, acciones, permisos, memoria, RAG, PostgreSQL, arquitectura hexagonal, despliegue, rollback, observabilidad y escenarios end-to-end.

## Regla añadida

Antes de implementar una funcionalidad compleja, la IA debe ubicar o crear primero su pseudocódigo equivalente.
