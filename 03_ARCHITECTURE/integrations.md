---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Integraciones

## Principio

Toda integración externa se implementa como adaptador detrás de un puerto.

## Integraciones iniciales

### OpenAI Realtime / Voice

Uso: conversación de voz realtime.

Puerto: `VoiceProviderPort`.

### LiveKit

Uso: WebRTC, SIP, salas realtime.

Puerto: `RealtimeTransportPort`.

### HeyGen / LiveAvatar

Uso: avatar y telepresencia.

Puerto: `AvatarProviderPort`.

### PostgreSQL

Uso: persistencia principal.

Puerto: repositorios.

### Redis

Uso: sesiones activas, locks, caché temporal.

Puerto: `SessionStatePort`.

### Email provider

Uso: notificaciones.

Puerto: `NotificationPort`.

### Calendar provider

Uso: citas y reuniones.

Puerto: `CalendarPort`.

### CRM provider

Uso: perfiles, oportunidades, historial.

Puerto: `CRMPort`.

### Ticketing provider

Uso: incidencias.

Puerto: `TicketingPort`.

## Reglas de integración

- Nunca exponer SDK externo al dominio.
- Validar input y output.
- Manejar timeouts.
- Registrar auditoría si modifica datos.
- Tener fallback o mensaje claro si falla.
- Añadir tests de contrato.
