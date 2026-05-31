# Política de memoria Hermes

## Objetivo

Usar memoria para mejorar continuidad sin contaminar contexto, exponer datos o generar comportamiento impredecible.

## Tipos de memoria permitida

- Preferencias de desarrollo.
- Convenciones del proyecto.
- Decisiones técnicas aprobadas.
- Rutas del repositorio.
- Reglas de trabajo.
- Aprendizajes no sensibles.

## Memoria prohibida

- API keys.
- Contraseñas.
- Datos personales de clientes.
- Grabaciones de llamadas.
- Información médica, financiera o legal sensible de usuarios finales.
- Tokens de acceso.

## Flujo para guardar memoria

```txt
Detectar aprendizaje
→ Clasificar sensibilidad
→ Verificar utilidad futura
→ Resumir en una frase concreta
→ Guardar solo si cumple política
→ Revisar memoria periódicamente
```

## Regla clave

La memoria de Hermes es memoria de trabajo interno, no base de datos de clientes.
