---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Glosario

## AURION

Plataforma de agentes de voz, acciones realtime y telepresencia empresarial.

## Tenant

Empresa cliente dentro del sistema multi-tenant.

## Agente de voz

Entidad conversacional realtime que atiende usuarios mediante voz.

## Agente interno

Agente Hermes que ayuda a construir, mantener o auditar AURION.

## Tool

Herramienta ejecutable por un agente para consultar o modificar sistemas.

## Skill

Capacidad reusable de un agente interno, documentada y gobernada.

## MCP

Model Context Protocol. Estándar para conectar agentes con herramientas y fuentes externas.

## RAG

Retrieval-Augmented Generation. Técnica para responder consultando documentos y conocimiento externo.

## Handoff

Transferencia de responsabilidad entre agentes o hacia humano.

## Audit log

Registro inmutable de acciones relevantes.

## Hexagonal Architecture

Arquitectura donde el dominio se comunica con el exterior mediante puertos y adaptadores.

## Clean Architecture

Arquitectura que separa dominio, casos de uso, interfaces e infraestructura.
