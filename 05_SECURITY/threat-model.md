---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Threat Model — STRIDE

## Spoofing

Riesgo: un usuario se hace pasar por otro.

Controles:

- Verificación de identidad según riesgo.
- MFA para administradores.
- Tokens firmados.

## Tampering

Riesgo: modificación de datos, prompts o acciones.

Controles:

- Auditoría.
- Integridad de logs.
- Validación de herramientas.
- Migraciones revisadas.

## Repudiation

Riesgo: negar que se ejecutó una acción.

Controles:

- Audit logs append-only.
- Actor ID.
- Timestamp.
- Correlation ID.

## Information Disclosure

Riesgo: fuga de datos personales o secretos.

Controles:

- Cifrado.
- Redacción de logs.
- Separación por tenant.
- Control de permisos.

## Denial of Service

Riesgo: saturación de voz, API o proveedores.

Controles:

- Rate limiting.
- Circuit breakers.
- Colas.
- Fallbacks.

## Elevation of Privilege

Riesgo: usuario o agente gana permisos indebidos.

Controles:

- RBAC.
- Policy engine.
- Revisión de tools.
- Separación de entornos.
