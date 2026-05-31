---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Gestión de secretos

## Principio

Los secretos nunca se guardan en código, documentación ni logs.

## Secretos

- API keys.
- Tokens OAuth.
- Credenciales de base de datos.
- Webhook secrets.
- Certificados.
- Claves de cifrado.

## Reglas

- Usar variables de entorno o gestor de secretos.
- Separar secretos por entorno.
- Rotar periódicamente.
- Revocar al detectar exposición.
- No compartir secretos con agentes IA salvo herramienta segura y limitada.

## Prohibido

- `.env` en repositorio.
- Secretos en prompts.
- Secretos en issues.
- Secretos en logs.
- Secretos en documentación.

## Checklist

- `.gitignore` configurado.
- Escáner de secretos en CI.
- Variables separadas dev/stage/prod.
- Acceso mínimo.
