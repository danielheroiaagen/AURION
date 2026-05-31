---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Respuesta a incidentes

## Severidades

### SEV-1

Fuga de datos, producción caída, acciones incorrectas masivas, compromiso de secretos.

### SEV-2

Degradación importante, errores repetidos, fallo de integración crítica.

### SEV-3

Bug limitado, fallo parcial o incidencia sin datos sensibles.

## Proceso

1. Detectar.
2. Contener.
3. Evaluar impacto.
4. Comunicar internamente.
5. Corregir.
6. Verificar.
7. Documentar postmortem.
8. Prevenir recurrencia.

## Checklist SEV-1

- Pausar herramienta afectada.
- Revocar secretos si aplica.
- Activar modo degradado.
- Preservar logs.
- Notificar responsables.
- Preparar comunicación cliente si aplica.

## Postmortem

Debe incluir:

- Qué pasó.
- Impacto.
- Línea temporal.
- Causa raíz.
- Qué funcionó.
- Qué falló.
- Acciones preventivas.
