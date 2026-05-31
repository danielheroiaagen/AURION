# Ciclo de vida de skills Hermes

## Objetivo

Convertir tareas repetibles en skills sin crear una biblioteca caótica.

## Estados de una skill

```txt
idea → draft → reviewed → approved → active → deprecated → archived
```

## Criterios para crear una skill

Una skill solo debe crearse si:

- La tarea se repetirá varias veces.
- El proceso tiene pasos claros.
- Puede probarse.
- Tiene límites de seguridad.
- Mejora la precisión del agente.

## Estructura mínima de skill

```txt
skill-name/
├── SKILL.md
├── examples/
├── tests/
├── resources/
└── CHANGELOG.md
```

## Reglas

- Toda skill debe tener propósito, entradas, salidas, límites y ejemplos.
- Toda skill con herramientas externas necesita permisos explícitos.
- Skills que ejecuten comandos requieren revisión de seguridad.
- Skills obsoletas se deprecian, no se borran sin historial.
