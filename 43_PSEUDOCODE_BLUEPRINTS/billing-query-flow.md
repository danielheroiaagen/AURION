# Flujo de consulta de facturación

## Objetivo

Resolver dudas de facturación sin exponer datos indebidamente.

## Actores

- Cliente
- Voice Agent
- Billing Adapter
- Identity Service

## Entradas

- Pregunta de factura
- Identidad
- Tenant

## Salidas

- Respuesta
- Escalado
- Ticket

## Flujo humano

1. Identificar cliente.
2. Verificar nivel necesario.
3. Consultar billing.
4. Explicar en lenguaje claro.
5. Ofrecer envío por email seguro.

## Pseudocódigo

```txt
FUNC consultar_facturacion(cliente, pregunta):
    SI identidad.confianza < REQUERIDA:
        pedir_verificacion_extra()

    factura = billing.buscar(cliente, pregunta)
    SI factura.no_encontrada:
        crear_ticket_facturacion()
    SINO:
        responder_resumen_seguro(factura)
```

## Reglas

- No leer datos completos de tarjeta.
- No revelar facturas sin identificación.

## Tests de aceptación

- Consulta simple se resuelve.
- Dato sensible pide verificación.
