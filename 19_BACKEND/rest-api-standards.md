---
project: AURION
document: Rest Api Standards
folder: 19_BACKEND
owner: Daniel Gonzalez Junco
status: draft-v2
created_at: 2026-05-30
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# REST API Standards

## Objetivo
Establecer reglas HTTP consistentes para que los contratos REST de AURION sean seguros, auditables y fáciles de integrar.

La decisión vigente está en `ADR-009`: REST OpenAPI-first para el MVP.

## Alcance
Este documento pertenece a **19_BACKEND** y forma parte del paquete documental maestro de AURION. Su función es impedir improvisación, alinear a agentes IA y humanos, y mantener una ejecución profesional.

## Decisiones no negociables
- Arquitectura hexagonal y Clean Architecture son obligatorias.
- PostgreSQL es la fuente principal de verdad.
- Los controladores no contienen lógica de negocio.
- Toda acción crítica debe ser auditable, idempotente y autorizada.
- OpenAPI es el contrato revisable de requests/responses.
- Las respuestas de error siguen estilo Problem Details.
- Toda respuesta debe poder correlacionarse con `correlation_id`.
- Operaciones mutantes reintentables usan `Idempotency-Key`.

## Versionado

- Usar prefijo `/v1`.
- No romper contratos sin ADR o plan de compatibilidad.
- Los cambios breaking requieren nueva versión o migración documentada.

## Errores

Formato base Problem Details:

```json
{
  "type": "https://docs.aurion.local/errors/permission-denied",
  "title": "Permission denied",
  "status": 403,
  "detail": "Actor cannot execute this action for the requested tenant.",
  "code": "permission_denied",
  "correlation_id": "req_01HY..."
}
```

## Paginación

Las listas usan **cursor pagination**:

```json
{
  "data": [],
  "page": {
    "next_cursor": "cur_...",
    "has_more": false
  }
}
```

## Idempotencia

- `POST /v1/actions` y otras operaciones mutantes reintentables aceptan `Idempotency-Key`.
- La misma key con el mismo payload debe producir el mismo resultado lógico.
- La misma key con payload distinto debe devolver error de conflicto.

## Cabeceras estándar

| Header | Uso |
|--------|-----|
| `Authorization` | JWT Bearer token. |
| `Idempotency-Key` | Reintentos seguros en operaciones mutantes. |
| `X-Correlation-Id` | Trazabilidad entre cliente, API, logs y audit. |

## Códigos HTTP base

| Código | Uso |
|--------|-----|
| `200` | Lectura o acción completada. |
| `201` | Recurso creado. |
| `202` | Acción aceptada para procesamiento. |
| `400` | Request inválido. |
| `401` | Falta autenticación. |
| `403` | Autenticado sin permiso. |
| `404` | Recurso inexistente o fuera del tenant autorizado. |
| `409` | Conflicto de estado o idempotencia. |
| `422` | Reglas de negocio no satisfechas. |
| `429` | Rate limit. |
| `500` | Error interno no esperado. |

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
- `19_BACKEND/api-design.md`
- `19_BACKEND/auth-authorization.md`
- `19_BACKEND/idempotency.md`
- `08_DEVELOPMENT/agent.md`
- `11_TESTING/testing-strategy.md`

## Estado
Documento vivo. Debe actualizarse cuando cambie producto, arquitectura, mercado, seguridad o proceso operativo.
