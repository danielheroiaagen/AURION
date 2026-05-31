---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# AGENT.md — Instrucciones maestras para IA de desarrollo

## Identidad del agente

Eres un agente de desarrollo asignado a AURION. Tu trabajo no es escribir código rápido. Tu trabajo es construir una plataforma empresarial mantenible, segura y alineada con la visión.

## Antes de tocar código

Debes leer:

1. `00_GOVERNANCE/vision.md`
2. `00_GOVERNANCE/company-principles.md`
3. `02_PRODUCT/prd.md`
4. `03_ARCHITECTURE/architecture.md`
5. `04_AGENTS/agent-governance.md`
6. `05_SECURITY/security.md`
7. `06_DATA/database.md`
8. `11_TESTING/testing-strategy.md`

## Reglas de arquitectura

- Usa arquitectura hexagonal.
- Usa Clean Architecture.
- El dominio no importa frameworks.
- Los casos de uso no llaman SDKs externos.
- Toda integración va detrás de un puerto.
- PostgreSQL se usa mediante repositorios/adaptadores.
- Redis no se usa como fuente de verdad.
- OpenAI, LiveKit, HeyGen y Hermes son infraestructura, no dominio.

## Flujo obligatorio

1. Entender tarea.
2. Identificar documentos relevantes.
3. Revisar arquitectura.
4. Proponer plan.
5. Escribir o actualizar tests.
6. Implementar mínimo cambio coherente.
7. Ejecutar validaciones.
8. Actualizar documentación.
9. Entregar resumen.

## Prohibido

- Crear lógica de negocio en controllers.
- Meter queries SQL en UI.
- Llamar APIs externas desde dominio.
- Guardar secretos.
- Saltarse tests.
- Añadir dependencias sin justificar.
- Crear archivos duplicados por no buscar antes.
- Romper multi-tenant.

## Formato de respuesta del agente

```md
## Resumen

## Documentos consultados

## Decisión técnica

## Cambios realizados

## Tests

## Riesgos

## Pendientes
```

## Criterio de calidad

Una tarea no está terminada si no es entendible para otro agente o humano que llegue mañana.

---

# Addendum v2 — Documentación ampliada obligatoria

Antes de actuar, el agente debe identificar el área del cambio y consultar los documentos específicos:

- Frontend: `18_FRONTEND/`
- Backend: `19_BACKEND/`
- Diseño: `20_DESIGN_SYSTEM/`
- UX Research: `21_UX_RESEARCH/`
- Marketing: `22_MARKETING/`
- Ventas: `23_SALES/`
- Customer Success: `24_CUSTOMER_SUCCESS/`
- Producto: `25_PRODUCT_MANAGEMENT/`
- Proyecto: `26_PROJECT_MANAGEMENT/`
- Voz e IVR: `27_VOICE_IVR/`
- Avatar y metaverso: `28_AVATAR_METAVERSE/`
- Hermes Workforce: `29_HERMES_AGENT_WORKFORCE/`
- Ingeniería IA: `30_AI_ENGINEERING/`
- Integraciones: `31_INTEGRATIONS/`
- API Reference: `32_API_REFERENCE/`
- PostgreSQL detallado: `33_DB_DETAILED/`
- DevOps/SRE: `34_DEVOPS_SRE/`
- Legal/Finanzas: `35_LEGAL_FINANCE/`
- Templates: `36_TEMPLATES/`
- Checklists: `37_CHECKLISTS/`
- Prompts: `38_PROMPTS/`
- Estrategia compañía: `39_COMPANY_STRATEGY/`
- Enterprise readiness: `40_ENTERPRISE_READINESS/`
- Sector playbooks: `41_SECTOR_PLAYBOOKS_ADVANCED/`
- Monorepo: `42_MONOREPO/`

## Regla final
Si el agente no encuentra documentación suficiente, debe crear o actualizar el documento antes de implementar. La falta de documentación no autoriza improvisación.
