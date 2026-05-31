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
Este documento guía servicios backend con casos de uso, puertos, adaptadores, dominio, PostgreSQL, eventos y seguridad.

## Alcance
Este documento pertenece a **19_BACKEND** y forma parte del paquete documental maestro de AURION. Su función es impedir improvisación, alinear a agentes IA y humanos, y mantener una ejecución profesional.

## Decisiones no negociables
- Arquitectura hexagonal y Clean Architecture son obligatorias.
- PostgreSQL es la fuente principal de verdad.
- Los controladores no contienen lógica de negocio.
- Toda acción crítica debe ser auditable, idempotente y autorizada.

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
