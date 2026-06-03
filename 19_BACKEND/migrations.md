---
project: AURION
document: Migrations
folder: 19_BACKEND
owner: Daniel Gonzalez Junco
status: draft-v2
created_at: 2026-05-30
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Migrations

## Objetivo
Definir cómo AURION versiona cambios de base de datos sin entregar el control del esquema a un ORM.

La decisión vigente está en `ADR-008`: PostgreSQL es la fuente de verdad, las migraciones son **SQL-first**, y el código usa una capa ligera para consultar.

## Alcance
Este documento pertenece a **19_BACKEND** y forma parte del paquete documental maestro de AURION. Su función es impedir improvisación, alinear a agentes IA y humanos, y mantener una ejecución profesional.

## Decisiones no negociables
- Arquitectura hexagonal y Clean Architecture son obligatorias.
- PostgreSQL es la fuente principal de verdad.
- La versión objetivo mínima es PostgreSQL 15 para soportar constraints usadas por el schema MVP.
- Los controladores no contienen lógica de negocio.
- Toda acción crítica debe ser auditable, idempotente y autorizada.
- Las migraciones viven en `database/migrations`.
- Cada migración debe tener intención `up/down`, aunque una reversión peligrosa se documente como no automática.
- No auto-sync, no schema push y no auto-migrate desde la app en runtime.
- Todo cambio multi-tenant debe revisar `tenant_id`, índices, constraints y auditoría.

## Contrato de migraciones

| Regla | Motivo |
|-------|--------|
| SQL visible y revisable | Un reviewer debe entender exactamente qué cambia en PostgreSQL. |
| Nombre ordenable | Usar prefijo temporal/ordenado para evitar ambigüedad. |
| `up/down` explícito | Permite razonar despliegue, rollback y riesgo operativo. |
| Sin magia de ORM | La arquitectura no puede depender de sincronización automática. |
| CI antes de producción | Las migraciones son código crítico. |

## Versión PostgreSQL objetivo

La línea base de AURION es **PostgreSQL 15+**.

Motivo: el schema MVP usa claves foráneas compuestas con `ON DELETE SET NULL (column)` para que, al eliminar una membresía, se preserve el `tenant_id` del registro auditado y se limpie solo la columna de usuario atribuida.

## Estructura esperada

```text
database/
  README.md
  migrations/
    2026-06-01-0001-create-mvp-core.up.sql
    2026-06-01-0001-create-mvp-core.down.sql
```

## Migración MVP actual

La primera migración ejecutable crea el núcleo mínimo alineado con `ADR-007`, `ADR-008` y `ADR-009`:

- `tenants`
- `users`
- `tenant_memberships`
- `knowledge_documents`
- `voice_sessions`
- `controlled_actions`
- `audit_events`

## Checklist para cada migración

- [ ] ¿Incluye `tenant_id` si la tabla pertenece a clientes?
- [ ] ¿Tiene claves primarias, foreign keys y constraints explícitos?
- [ ] ¿Las referencias a usuarios en tablas tenant-owned validan `(tenant_id, user_id)` contra memberships?
- [ ] ¿Tiene índices para accesos esperados?
- [ ] ¿Considera audit trail cuando la tabla afecta acciones sensibles?
- [ ] ¿La reversión `down` es segura o documenta por qué no lo es?
- [ ] ¿No depende de estado implícito del ORM?

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
- `08_DEVELOPMENT/agent.md`
- `11_TESTING/testing-strategy.md`

## Estado
Documento vivo. Debe actualizarse cuando cambie producto, arquitectura, mercado, seguridad o proceso operativo.
