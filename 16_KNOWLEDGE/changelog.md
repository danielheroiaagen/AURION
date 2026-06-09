---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Changelog

## Objetivo

Historial de cambios.

## [Unreleased] — Phase 2: Auth & Security Hardening (2026-06-10)

### Added
- JWT authentication, tenant-scoped RBAC, and deny-by-default Policy Guard in the
  API (`ADR-007`), wired as global guards.
- Database security migration `0002`: Row-Level Security on all tenant-owned
  tables and append-only `audit_events`.
- HTTP edge hardening (`ADR-010`): Helmet headers, CORS allowlist, rate limiting,
  Problem Details exception filter, correlation ids.
- CI security: `npm audit` gate, gitleaks secret scan, CodeQL, Dependabot, and
  SHA-pinned GitHub Actions.
- ADR-010 (edge security), ADR-011 (PII protection at rest), phase-2 plan,
  `.env.example`, and Jest + Python test coverage.

### Security
- Closed the Phase 1 hardening findings: tenant isolation enforced at the DB,
  audit immutability, edge hardening, and supply-chain scanning.
- API now fails closed without a strong `JWT_SECRET`.

## Alcance

Este documento aplica a AURION completo, incluyendo plataforma SaaS, agentes de voz, avatar, Hermes Agent workforce, datos, infraestructura y operaciones.

## Puntos principales

- Added.
- Changed.
- Fixed.
- Security.
- Deprecated.

## Reglas

- Actualizar en cada release.


## Checklist para agentes IA

Antes de modificar este ámbito, el agente debe:

1. Leer este documento.
2. Revisar documentos relacionados.
3. Proponer cambios mínimos y justificados.
4. Añadir o actualizar tests si aplica.
5. Actualizar changelog o decisiones si corresponde.

## Criterio de aceptación

El trabajo relacionado con este documento se considera correcto cuando es seguro, verificable, documentado y coherente con arquitectura hexagonal, Clean Architecture y PostgreSQL como base principal.
