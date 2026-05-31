# Proveedores de modelo para Hermes

## Objetivo

Permitir flexibilidad sin lock-in.

## Proveedores posibles

- OpenAI.
- OpenRouter.
- Anthropic.
- Nous Portal.
- Modelos locales vía Ollama o endpoint compatible.

## Estrategia recomendada

```txt
Modelo principal: razonamiento y planificación.
Modelo barato: resúmenes, clasificación, tareas repetitivas.
Modelo local opcional: tareas privadas no críticas.
```

## Política de selección

Hermes debe usar el modelo adecuado según la tarea:

- Arquitectura: modelo fuerte.
- Documentación simple: modelo económico.
- Clasificación: modelo rápido.
- Seguridad: modelo fuerte + revisión humana.

## Regla de auditoría

Toda decisión de cambiar proveedor debe quedar registrada en ADR o changelog operativo.
