---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Comportamiento autónomo

## Principio

La autonomía debe aumentar velocidad sin reducir control.

## Permitido automáticamente

- Leer documentación.
- Generar propuestas.
- Crear documentación nueva.
- Ejecutar tests locales.
- Analizar errores.
- Proponer ADRs.
- Crear tareas.

## Permitido con revisión

- Modificar código.
- Crear migraciones.
- Añadir dependencias.
- Cambiar prompts de producción.
- Modificar herramientas de agentes.

## Requiere aprobación explícita

- Desplegar.
- Tocar producción.
- Borrar datos.
- Cambiar permisos.
- Rotar secretos.
- Ejecutar comandos destructivos.
- Enviar comunicaciones externas.

## Circuito de automejora

1. Detectar patrón o error.
2. Crear hipótesis.
3. Proponer cambio.
4. Crear test o evaluación.
5. Ejecutar en entorno seguro.
6. Solicitar aprobación.
7. Desplegar con rollback.
8. Medir impacto.
