---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# C4 Nivel 2 — Contenedores

## Contenedores principales

### Web App — Command Center

Panel administrativo para empresas, supervisores y desarrolladores.

Tecnología recomendada: Next.js + TypeScript + Tailwind.

### API Gateway

Entrada HTTP para frontend, integraciones y webhooks.

Responsabilidades:

- Autenticación.
- Rate limiting.
- Enrutamiento.
- Validación inicial.

### Core Backend

Aplicación principal con casos de uso.

Responsabilidades:

- Tenants.
- Conversaciones.
- Acciones.
- Auditoría.
- Configuración.

### Voice Runtime

Servicio especializado para sesiones de voz realtime.

Responsabilidades:

- WebRTC/SIP.
- Conexión con proveedor realtime.
- Manejo de interrupciones.
- Estado de sesión.

### Memory Service

Servicio para RAG, embeddings, búsqueda semántica y memoria.

### Action Fabric Service

Servicio para registrar, validar y ejecutar herramientas empresariales.

### Avatar Service

Servicio para orquestar proveedor avatar, lipsync y presencia visual.

### Evaluation Service

Servicio para evaluar conversaciones y detectar errores.

### Hermes Workforce

Conjunto de agentes internos en VPS para desarrollo, documentación y mejora controlada.

### PostgreSQL

Base principal transaccional.

### Redis

Estado temporal, sesiones realtime y locks.

### Object Storage

Grabaciones, documentos, adjuntos y exportaciones.
