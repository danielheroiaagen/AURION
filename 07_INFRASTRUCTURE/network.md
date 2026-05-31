---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Red

## Componentes

- Reverse proxy.
- API Gateway.
- Voice Runtime.
- WebRTC/SIP ingress.
- PostgreSQL privado.
- Redis privado.
- Object storage.

## Reglas

- Base de datos no expuesta públicamente.
- Redis no expuesto públicamente.
- Panel admin protegido por TLS.
- Webhooks con firma.
- Rate limiting en APIs públicas.
- Puertos mínimos abiertos.

## Tráfico realtime

WebRTC/SIP requiere especial atención en:

- NAT.
- TURN/STUN.
- Certificados.
- Latencia.
- Región.
- Fallback.
