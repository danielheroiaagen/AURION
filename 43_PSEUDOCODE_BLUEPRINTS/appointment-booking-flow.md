# Flujo de reserva o cambio de cita

## Objetivo

Gestionar citas mediante calendario o CRM.

## Actores

- Cliente
- Voice Agent
- Calendar Adapter
- CRM Adapter
- Audit Service

## Entradas

- Solicitud de cita
- Disponibilidad
- Datos cliente

## Salidas

- Cita creada
- Cita modificada
- Alternativas ofrecidas

## Flujo humano

1. Entender servicio requerido.
2. Consultar disponibilidad.
3. Ofrecer opciones.
4. Confirmar selección.
5. Crear/modificar cita.
6. Enviar confirmación.
7. Auditar.

## Pseudocódigo

```txt
FUNC gestionar_cita(solicitud, cliente):
    servicio = extraer_servicio(solicitud)
    preferencias = extraer_preferencias_fecha(solicitud)
    slots = calendar.buscar_disponibilidad(servicio, preferencias)

    SI slots.vacios:
        ofrecer_alternativas()
        return

    slot = cliente_elige(slots)
    confirmar("¿Confirmo la cita para " + slot + "?")
    cita = calendar.crear(cliente, servicio, slot)
    crm.registrar_evento(cliente, cita)
    notificar(cliente, cita)
```

## Reglas

- No crear cita sin confirmación.
- Registrar cambios en CRM.
- Gestionar zona horaria.

## Tests de aceptación

- Cita se crea si hay disponibilidad.
- Si no hay huecos se ofrecen alternativas.
