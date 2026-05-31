---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Política de retención

## Objetivo

Definir cuánto tiempo se guardan datos y cuándo se eliminan o anonimizan.

## Categorías

### Conversaciones

Retención configurable por tenant.

### Grabaciones

Retención corta por defecto salvo necesidad contractual.

### Transcripciones

Retención según contrato y cumplimiento.

### Audit logs

Retención más larga por seguridad y cumplimiento.

### Memoria de cliente

Solo mientras exista propósito legítimo.

### Documentos de conocimiento

Hasta eliminación o sustitución por versión nueva.

## Reglas

- Permitir borrado cuando aplique GDPR.
- Separar borrado lógico y físico.
- No borrar audit logs críticos sin política legal.
- Anonimizar cuando sea suficiente.
