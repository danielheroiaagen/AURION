---
project: AURION
document: Auth Authorization
folder: 19_BACKEND
owner: Daniel Gonzalez Junco
status: draft-v2
created_at: 2026-05-30
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Auth Authorization

## Objetivo
Definir cómo el backend de AURION autentica actores y autoriza acciones sin romper arquitectura hexagonal, tenant isolation ni auditoría.

La decisión vigente está en `ADR-007`: **JWT + tenant-scoped RBAC + Policy Guard**.

## Alcance
Este documento pertenece a **19_BACKEND** y forma parte del paquete documental maestro de AURION. Su función es impedir improvisación, alinear a agentes IA y humanos, y mantener una ejecución profesional.

## Decisiones no negociables
- Arquitectura hexagonal y Clean Architecture son obligatorias.
- PostgreSQL es la fuente principal de verdad.
- Los controladores no contienen lógica de negocio.
- Toda acción crítica debe ser auditable, idempotente y autorizada.
- JWT identifica al actor; no decide permisos por sí solo.
- Policy Guard es la frontera obligatoria antes de ejecutar casos de uso protegidos.
- Todo recurso de cliente debe validar `tenant_id`.

## Flujo backend MVP

1. El cliente envía un JWT firmado.
2. El adaptador HTTP valida firma, expiración y actor.
3. El caso de uso recibe identidad normalizada: actor, tenant, rol y permisos solicitados.
4. El **Policy Guard** evalúa actor + acción + recurso + `tenant_id`.
5. Si la acción es sensible, se registra decisión de audit antes o durante la ejecución.
6. Si falta contexto o permiso, se deniega por defecto.

## Boundary de implementación

| Capa | Responsabilidad |
|------|-----------------|
| Controller / NestJS Guard | Validar transporte, JWT y extraer identidad mínima. |
| Application Use Case | Pedir autorización antes de ejecutar negocio protegido. |
| Policy Guard | Decidir permiso con reglas de rol, tenant, recurso y riesgo. |
| Domain | Mantener invariantes de negocio sin depender de NestJS. |
| Infrastructure | Persistir usuarios, roles, tenant memberships y audit logs. |

## Reglas para agentes IA

- No metas reglas de permisos directamente en controladores.
- No uses un booleano genérico tipo `isAdmin` para saltarte policies.
- No permitas que `Voice Agent` herede permisos humanos completos.
- No implementes tools sin permiso específico `tool:execute:*`.
- No mezcles autenticación con autorización: son conceptos distintos.

## Casos que deben tener tests

- JWT válido pero sin permiso suficiente.
- Actor con rol correcto intentando acceder a otro `tenant_id`.
- Voice Agent ejecutando una tool permitida.
- Voice Agent intentando una acción que requiere human approval.
- Acción sensible dejando evidencia de audit.

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
- `03_ARCHITECTURE/adr/ADR-007-auth-rbac-policy-model.md`
- `05_SECURITY/permissions.md`
- `08_DEVELOPMENT/agent.md`
- `11_TESTING/testing-strategy.md`

## Estado
Documento vivo. Debe actualizarse cuando cambie producto, arquitectura, mercado, seguridad o proceso operativo.
