# 19_BACKEND

## Propósito
Documentación del backend con arquitectura hexagonal, Clean Architecture, PostgreSQL, eventos, APIs, permisos, multi-tenant y herramientas de acción empresarial.

## Uso por agentes IA
Antes de modificar cualquier parte relacionada con esta carpeta, el agente debe leer este README y el documento concreto aplicable.

## Documentos incluidos
- `backend-vision.md`
- `backend-architecture.md`
- `hexagonal-clean-architecture-guide.md`
- `domain-modeling.md`
- `bounded-contexts.md`
- `api-design.md`
- `rest-api-standards.md`
- `websocket-events.md`
- `background-jobs.md`
- `queues-events.md`
- `command-query-separation.md`
- `auth-authorization.md`
- `multi-tenant-backend.md`
- `postgres-repositories.md`
- `migrations.md`
- `validation-errors.md`
- `rate-limits.md`
- `idempotency.md`
- `backend-testing.md`
- `backend-agent-instructions.md`

## Regla
Si un documento no cubre una decisión necesaria, crear una propuesta y actualizar la documentación antes de implementar.

## Decisión Phase 1

El backend MVP usa **NestJS + TypeScript**.

Referencia: `03_ARCHITECTURE/adr/ADR-006-nestjs-typescript-backend.md`.

Regla crítica: NestJS no entra en el dominio. El framework se limita a interfaces, módulos de wiring y adaptadores.
