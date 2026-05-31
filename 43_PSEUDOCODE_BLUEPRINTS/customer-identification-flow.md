# Flujo de identificación de cliente

## Objetivo

Identificar al usuario antes de acceder a datos privados.

## Actores

- Cliente
- Voice Agent
- Identity Service
- CRM Adapter

## Entradas

- Número de teléfono
- Email
- Datos declarados
- Tenant

## Salidas

- Cliente identificado
- Cliente desconocido
- Verificación fallida

## Flujo humano

1. Buscar por número.
2. Pedir dato adicional si hay coincidencias múltiples.
3. Validar identidad.
4. Asignar nivel de confianza.
5. Permitir solo acciones acordes al nivel.

## Pseudocódigo

```txt
FUNC identificar_cliente(input, tenant):
    candidatos = crm.buscar_por_numero(input.telefono)

    SI candidatos.count == 0:
        return CLIENTE_DESCONOCIDO

    SI candidatos.count > 1:
        dato = pedir_verificacion("email o referencia")
        cliente = filtrar(candidatos, dato)
    SINO:
        cliente = candidatos[0]

    confianza = calcular_confianza(cliente, input)
    return Identidad(cliente, confianza)
```

## Reglas

- Sin identificación no se revelan datos sensibles.
- La verificación debe ser proporcional al riesgo.

## Tests de aceptación

- Cliente con número único se identifica con confianza básica.
- Acción sensible requiere verificación extra.
