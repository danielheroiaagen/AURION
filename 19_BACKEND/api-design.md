---
project: AURION
document: Api Design
folder: 19_BACKEND
owner: Daniel Gonzalez Junco
status: draft-v2
created_at: 2026-05-30
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# API Design

## Objetivo
Definir la superficie API del MVP sin improvisar endpoints mientras crece el backend.

La decisión vigente está en `ADR-009`: contratos **OpenAPI-first REST**, pequeños, tenant-scoped y alineados con el Voice Agent SaaS Core.

## Alcance
Este documento pertenece a **19_BACKEND** y forma parte del paquete documental maestro de AURION. Su función es impedir improvisación, alinear a agentes IA y humanos, y mantener una ejecución profesional.

## Decisiones no negociables
- Arquitectura hexagonal y Clean Architecture son obligatorias.
- PostgreSQL es la fuente principal de verdad.
- Los controladores no contienen lógica de negocio.
- Toda acción crítica debe ser auditable, idempotente y autorizada.
- Todo endpoint de cliente debe validar `tenant_id`.
- Todo contrato se diseña antes de implementar controladores.
- Cada endpoint protegido debe respetar `ADR-007`.
- Cada endpoint persistente debe respetar `ADR-008`.

## Contratos MVP

| Grupo | Endpoint base | Qué resuelve | Riesgo principal |
|-------|---------------|--------------|------------------|
| Tenants | `/api/v1/tenants` | Configuración de empresas cliente. | Cross-tenant access. |
| Users | `/api/v1/users` | Usuarios humanos del tenant. | Escalada de permisos. |
| Memberships | `/api/v1/memberships` | Roles por tenant. | Rol global accidental. |
| Knowledge | `/api/v1/knowledge-documents` | Documentos para la base de conocimiento. | Publicar conocimiento incorrecto. |
| Voice | `/api/v1/voice-sessions` | voice sessions, transcript, summary y outcome. | Perder evidencia conversacional. |
| Actions | `/api/v1/actions` | controlled actions ejecutadas por humano o Voice Agent. | Acción sin autorización/audit. |
| Audit | `/api/v1/audit-events` | Lectura de eventos de seguridad y operación. | Exposición de evidencia sensible. |

## Boundary de implementación

| Capa | Responsabilidad |
|------|-----------------|
| Controller | Validar transporte HTTP, DTOs y auth mínima. |
| Application use case | Ejecutar intención del negocio. |
| Policy Guard | Autorizar actor + acción + recurso + `tenant_id`. |
| Domain | Reglas centrales sin depender de NestJS. |
| Infrastructure | Persistencia, audit log, integraciones y queries. |

## Reglas de contrato

- El contrato público usa `/api/v1`.
- Los IDs externos deben ser estables y no filtrar implementación interna.
- Las acciones mutantes deben declarar idempotencia.
- Las respuestas de error deben incluir `correlation_id`.
- La documentación OpenAPI debe ser revisable en PR antes de ampliar endpoints.
- Los endpoints de Voice Agent nunca deben saltarse permisos por ser “máquina”.

## Directrices específicas
- Mantener lenguaje claro, operativo y verificable.
- Separar decisiones de negocio, producto, arquitectura y ejecución.
- Registrar cualquier decisión relevante en el documento adecuado o en un ADR.
- Evitar soluciones mágicas, genéricas o difíciles de auditar.
- Diseñar siempre pensando en clientes reales, datos reales, llamadas reales y soporte real.

## Entregables esperados
- Especificación clara.
- Criterios de aceptación.
- Riesgos y dependencias.
- Relación con arquitectura hexagonal, Clean Architecture y PostgreSQL cuando aplique.
- Checklist de revisión para humanos y agentes IA.

## Checklist obligatorio para IA
- [ ] Objetivo entendido y escrito.
- [ ] Documentos relacionados revisados.
- [ ] Restricciones de arquitectura respetadas.
- [ ] Seguridad, permisos y auditoría considerados.
- [ ] Pruebas o criterios de validación definidos.
- [ ] Impacto en cliente, negocio y operaciones evaluado.
- [ ] Changelog o decisión actualizada si aplica.

## Antipatrones prohibidos
- Crear funcionalidad sin caso de uso.
- Copiar patrones sin adaptarlos a AURION.
- Omitir permisos, trazabilidad o manejo de errores.
- Documentar de forma vaga.
- Mezclar responsabilidades que deben estar separadas.

## Documentos relacionados
- `00_GOVERNANCE/vision.md`
- `02_PRODUCT/prd.md`
- `03_ARCHITECTURE/architecture.md`
- `03_ARCHITECTURE/adr/ADR-009-mvp-api-contracts.md`
- `19_BACKEND/rest-api-standards.md`
- `08_DEVELOPMENT/agent.md`
- `11_TESTING/testing-strategy.md`

## Estado
Documento vivo. Debe actualizarse cuando cambie producto, arquitectura, mercado, seguridad o proceso operativo.
