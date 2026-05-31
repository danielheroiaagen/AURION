# Revisión de código por Hermes

## Objetivo

Usar agentes para revisar código de forma consistente.

## Checklist

- ¿Respeta arquitectura hexagonal?
- ¿El dominio está libre de frameworks?
- ¿Los casos de uso no dependen de adapters?
- ¿Hay tests?
- ¿Hay manejo de errores?
- ¿Hay logs auditables?
- ¿Se filtran datos sensibles?
- ¿La migración PostgreSQL es reversible?
- ¿Se actualizó documentación?

## Salida esperada

```txt
Resumen
Riesgos
Bloqueantes
Sugerencias
Tests faltantes
Veredicto: approve/request changes/block
```

## Regla

Hermes puede recomendar aprobación, pero no fusiona cambios críticos por sí solo.
