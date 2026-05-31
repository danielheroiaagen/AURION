# Límites de Hermes en producción

## Decisión

Hermes no forma parte del camino crítico de una llamada de cliente en producción.

## Permitido

- Analizar logs anonimizados.
- Proponer mejoras.
- Generar documentación.
- Preparar scripts revisables.
- Crear tareas.
- Crear tests.

## No permitido

- Atender llamadas finales.
- Cambiar registros de clientes.
- Ejecutar migraciones productivas.
- Crear usuarios productivos.
- Modificar billing.
- Borrar datos.

## Motivo

El runtime de clientes necesita baja latencia, SLA, control estricto y observabilidad especializada. Hermes está optimizado para trabajo autónomo y mejora, no para ser la capa crítica de voz.
