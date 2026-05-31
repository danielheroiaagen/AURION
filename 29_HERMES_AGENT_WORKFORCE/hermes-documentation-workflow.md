# Workflow documental Hermes

## Objetivo

Mantener documentación viva sin generar ruido.

## Cuándo actualizar documentación

- Cambio de arquitectura.
- Nueva integración.
- Nuevo flujo de cliente.
- Nuevo agente.
- Nuevo endpoint.
- Cambio de base de datos.
- Cambio de despliegue.
- Incidente.
- Nueva decisión de seguridad.

## Flujo

```txt
Detectar cambio
→ Identificar documentos afectados
→ Proponer actualización
→ Verificar consistencia
→ Actualizar changelog
→ Marcar versión
```

## Regla

Si el código cambia y la documentación no, el sistema empieza a mentir. Y una plataforma que miente se rompe antes de escalar.
