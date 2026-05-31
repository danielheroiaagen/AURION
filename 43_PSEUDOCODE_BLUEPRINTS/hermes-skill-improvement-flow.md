# Flujo de mejora de skill Hermes

## Objetivo

Definir cómo Hermes transforma experiencia en una skill aprobada.

## Actores

- Hermes Agent
- Skill Reviewer
- Security Agent
- Human Reviewer

## Entradas

- Patrón repetido
- Conversación previa
- Resultado

## Salidas

- Skill draft
- Skill aprobada
- Skill rechazada

## Flujo humano

1. Detectar repetición.
2. Proponer skill.
3. Escribir draft.
4. Añadir límites.
5. Añadir tests.
6. Revisar seguridad.
7. Aprobar o rechazar.

## Pseudocódigo

```txt
FUNC proponer_skill(aprendizaje):
    SI no_es_repetible(aprendizaje):
        return NO_CREAR

    skill = crear_draft_skill(aprendizaje)
    skill.limites = definir_limites(aprendizaje)
    skill.tests = definir_tests(aprendizaje)
    riesgo = security_agent.evaluar(skill)

    SI riesgo == ALTO:
        return RECHAZAR_O_REVISAR

    enviar_a_revision_humana(skill)
```

## Reglas

- No activar skills sin revisión.
- Toda skill debe tener límites y tests.

## Tests de aceptación

- Patrón repetible genera draft.
- Skill peligrosa se bloquea.
