---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Gobierno de agentes

## Objetivo

Evitar que los agentes actúen sin control, dupliquen trabajo, rompan arquitectura o ejecuten acciones peligrosas.

## Niveles de autonomía

### Nivel 0 — Lectura

Puede leer documentación y código.

### Nivel 1 — Propuesta

Puede proponer cambios, ADRs, tests o diseños.

### Nivel 2 — Edición controlada

Puede modificar archivos no críticos en ramas de trabajo.

### Nivel 3 — Ejecución controlada

Puede ejecutar tests, linters y comandos no destructivos.

### Nivel 4 — Revisión humana obligatoria

Requiere aprobación para migraciones, despliegues, secretos, producción o acciones destructivas.

## Reglas

- Todo agente debe declarar objetivo antes de actuar.
- Todo agente debe leer documentos relevantes.
- Todo agente debe evitar cambios globales innecesarios.
- Todo agente debe entregar diff resumido.
- Todo agente debe proponer tests.

## Prohibiciones

- Cambiar producción.
- Borrar datos.
- Exponer secretos.
- Instalar dependencias sin justificación.
- Saltarse arquitectura.
- Mezclar capas.
