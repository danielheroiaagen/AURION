# Flujo de creación de ticket

## Objetivo

Crear tickets de soporte con información suficiente.

## Actores

- Cliente
- Voice Agent
- Ticket Adapter
- CRM
- Supervisor

## Entradas

- Problema descrito
- Cliente
- Prioridad
- Adjuntos opcionales

## Salidas

- Ticket creado
- Número de ticket
- Escalado

## Flujo humano

1. Capturar problema.
2. Clasificar categoría y urgencia.
3. Pedir datos faltantes.
4. Crear ticket.
5. Informar referencia.
6. Escalar si crítico.

## Pseudocódigo

```txt
FUNC crear_ticket(conversacion, cliente):
    problema = resumir_problema(conversacion)
    categoria = clasificar(problema)
    prioridad = calcular_prioridad(problema, cliente)

    SI falta_info_obligatoria(problema):
        preguntar_datos_faltantes()

    ticket = ticketing.crear(cliente, problema, categoria, prioridad)
    audit("ticket_created", ticket.id)
    responder("He creado el ticket " + ticket.codigo)
```

## Reglas

- No crear tickets vacíos.
- Prioridad crítica puede escalar a humano.

## Tests de aceptación

- Ticket incluye resumen, categoría y prioridad.
- Cliente recibe referencia.
