# Filosofía del pseudocódigo AURION

## Por qué existe

AURION es demasiado grande para permitir que la IA programe por impulso. El pseudocódigo funciona como idioma común entre CEO, producto, arquitectura, agentes y desarrollo.

## Qué debe conseguir

- Explicar la intención antes de implementar.
- Reducir ambigüedad.
- Detectar riesgos antes del código.
- Convertir flujos complejos en pasos claros.
- Servir como base de tests.

## Reglas

1. Cada flujo debe tener actores, entradas, salidas y errores.
2. Los pasos deben poder convertirse en tests.
3. Si una decisión afecta seguridad, debe pasar por guardrail.
4. Si una acción cambia datos, debe tener auditoría.
5. Si el agente no sabe, debe preguntar o escalar, no inventar.

## Traducción a Clean Architecture

```txt
Pseudocódigo humano
→ Caso de uso de aplicación
→ Puerto de entrada
→ Dominio
→ Puerto de salida
→ Adaptador externo
→ Tests
```
