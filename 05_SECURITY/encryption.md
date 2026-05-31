---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Cifrado

## En tránsito

Todo tráfico debe usar TLS.

Aplica a:

- APIs.
- WebRTC/SIP cuando corresponda.
- Conexiones a base de datos.
- Webhooks.
- Panel administrativo.

## En reposo

Deben cifrarse:

- Backups.
- Grabaciones.
- Documentos subidos.
- Tokens sensibles.
- Campos críticos.

## Claves

- Rotación planificada.
- Acceso mínimo.
- No registrar claves.
- Separación por entorno.

## Datos especialmente sensibles

- Grabaciones de voz.
- Transcripciones.
- Datos personales.
- Datos de salud o legales.
- Tokens OAuth.
