---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# C4 Nivel 1 — System Context

## Sistema principal

AURION es una plataforma SaaS que conecta empresas, clientes finales, agentes humanos, sistemas internos y proveedores de IA/voz/avatar.

## Actores externos

- Cliente final.
- Administrador de empresa.
- Agente humano.
- Supervisor.
- Desarrollador/integrador.
- Proveedor de voz IA.
- Proveedor SIP/telefonía.
- Proveedor avatar.
- CRM del cliente.
- Calendario del cliente.
- Sistema de tickets.
- Email/SMS/WhatsApp.

## Relaciones

```txt
Cliente final -> AURION -> Sistemas empresa
Administrador -> AURION Command Center
Agente humano -> AURION Escalation Console
AURION -> OpenAI Realtime
AURION -> LiveKit/SIP
AURION -> Avatar Provider
AURION -> PostgreSQL/Redis/Vector Store
AURION -> CRM/Calendar/Ticketing
Hermes Workforce -> Repositorio/Docs/Issues/CI
```

## Límites del sistema

AURION controla:

- Conversaciones.
- Configuración de agentes.
- Herramientas.
- Memoria.
- Auditoría.
- Integraciones.

AURION no controla:

- Disponibilidad absoluta de proveedores externos.
- Calidad de datos en sistemas del cliente.
- Decisiones humanas posteriores al escalado.
