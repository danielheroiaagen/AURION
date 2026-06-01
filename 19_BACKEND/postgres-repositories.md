---
project: AURION
document: Postgres Repositories
folder: 19_BACKEND
owner: Daniel Gonzalez Junco
status: draft-v2
created_at: 2026-05-30
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Postgres Repositories

## Objetivo
Definir cómo los repositorios de infraestructura hablan con PostgreSQL sin contaminar dominio ni casos de uso.

La decisión vigente está en `ADR-008`: PostgreSQL manda; Kysely y node-postgres ayudan desde infraestructura.

## Alcance
Este documento pertenece a **19_BACKEND** y forma parte del paquete documental maestro de AURION. Su función es impedir improvisación, alinear a agentes IA y humanos, y mantener una ejecución profesional.

## Decisiones no negociables
- Arquitectura hexagonal y Clean Architecture son obligatorias.
- PostgreSQL es la fuente principal de verdad.
- Los controladores no contienen lógica de negocio.
- Toda acción crítica debe ser auditable, idempotente y autorizada.
- Domain must not import Kysely, node-postgres, NestJS, DTOs ni modelos de persistencia.
- Los casos de uso dependen de puertos; los adaptadores implementan esos puertos con PostgreSQL.
- Kysely es la opción por defecto para consultas tipadas.
- node-postgres es el driver/base de conexión bajo Kysely.
- raw SQL escape hatch está permitido cuando PostgreSQL necesita control explícito.

## Boundary de repositorios

| Capa | Puede conocer PostgreSQL | Puede conocer Kysely |
|------|--------------------------|----------------------|
| Domain | No | No |
| Application use cases | No | No |
| Ports/interfaces | No | No |
| Infrastructure adapters | Sí | Sí |
| Tests de integración DB | Sí | Sí |

## Reglas de implementación

- Mapear filas de PostgreSQL a objetos de dominio dentro del adaptador.
- No devolver filas crudas desde casos de uso.
- No esconder queries críticas detrás de métodos genéricos tipo `save(any)`.
- Toda query de tenant debe filtrar por `tenant_id` salvo excepción documentada.
- Usar transacciones para cambios que combinen conversación, tool execution y audit trail.
- Usar SQL directo para locks, índices especializados, JSONB, pgvector, reporting complejo o performance crítica.

## Antipatrones específicos

- Repositorio que permite leer datos sin `tenant_id`.
- Entidad de dominio decorada con anotaciones de persistencia.
- Migración generada que nadie revisa.
- `synchronize: true`, schema push automático o auto-migrate al arrancar la API.
- ORM decidiendo relaciones sin ADR ni revisión de datos.

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
- `03_ARCHITECTURE/adr/ADR-008-postgresql-migrations-query-layer.md`
- `19_BACKEND/migrations.md`
- `08_DEVELOPMENT/agent.md`
- `11_TESTING/testing-strategy.md`

## Estado
Documento vivo. Debe actualizarse cuando cambie producto, arquitectura, mercado, seguridad o proceso operativo.
