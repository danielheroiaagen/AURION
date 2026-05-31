---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Seguridad

## Objetivo

Garantizar que AURION maneja conversaciones, acciones, datos de clientes, herramientas y agentes internos de forma segura.

## Principios

- Mínimo privilegio.
- Defensa en profundidad.
- Cifrado por defecto.
- Auditoría de acciones.
- Separación por tenant.
- Validación de inputs.
- No confianza implícita en modelos IA.

## Superficies de ataque

- Voz realtime.
- SIP/WebRTC.
- APIs públicas.
- Webhooks.
- Herramientas ejecutables.
- Panel administrativo.
- Integraciones CRM/calendario/tickets.
- Agentes Hermes.
- Base de datos.
- Object storage.

## Controles mínimos

- Autenticación fuerte.
- RBAC.
- Rate limiting.
- Validación de esquemas.
- Sanitización de tool inputs.
- Logs de auditoría.
- Gestión de secretos.
- Separación dev/stage/prod.
- Backups cifrados.

## IA y seguridad

El modelo no decide permisos. El modelo solicita acciones; el backend valida si están permitidas.

Nunca se debe permitir que una respuesta del modelo ejecute directamente una acción crítica sin pasar por policy engine.
