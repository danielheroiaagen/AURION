---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Política de memoria para agentes

## Tipos de memoria

### Memoria de proyecto

Decisiones, arquitectura, patrones, roadmap y reglas.

### Memoria de agente

Lecciones sobre cómo trabajar mejor en AURION.

### Memoria de cliente

Información de empresas usuarias y clientes finales. Altamente protegida.

### Memoria conversacional

Contexto temporal de una llamada o sesión.

## Reglas

- No guardar datos sensibles sin necesidad.
- No mezclar memoria entre tenants.
- No usar memoria de cliente para desarrollo interno.
- Toda memoria debe tener propósito.
- Debe existir política de retención.
- Debe poder borrarse si aplica GDPR.

## Memoria permitida para Hermes Agent

Hermes puede recordar:

- Estructura del proyecto.
- Decisiones técnicas.
- Skills útiles.
- Errores recurrentes.
- Procedimientos de despliegue.

Hermes no debe recordar:

- Secretos.
- Tokens.
- Datos personales innecesarios.
- Información privada de clientes sin base legal.
