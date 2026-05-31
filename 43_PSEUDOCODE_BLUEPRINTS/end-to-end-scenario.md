# Escenario end-to-end: cliente cambia una cita por teléfono

## Objetivo

Describir una historia completa desde llamada hasta registro final.

## Actores

- Cliente
- AURION Voice
- Calendar Adapter
- CRM
- Audit
- Supervisor opcional

## Entradas

- Llamada
- Número cliente
- Solicitud de cambio

## Salidas

- Cita cambiada
- Confirmación enviada
- Resumen guardado

## Flujo humano

1. Cliente llama.
2. AURION identifica tenant.
3. AURION identifica cliente.
4. Cliente pide cambiar cita.
5. Sistema consulta calendario.
6. Ofrece opciones.
7. Cliente elige.
8. Sistema confirma.
9. Actualiza calendario y CRM.
10. Envía confirmación.
11. Guarda resumen.

## Pseudocódigo

```txt
CLIENTE: "Quiero cambiar mi cita del martes."
AURION:
    tenant = identificar_tenant(numero_destino)
    cliente = identificar_cliente(numero_origen)
    cita_actual = calendar.buscar_proxima_cita(cliente)
    opciones = calendar.buscar_alternativas(servicio=cita_actual.servicio)
    hablar("Tengo estas opciones: ...")
    seleccion = escuchar_eleccion_cliente()
    confirmar("¿Confirmo el cambio a " + seleccion + "?")
    SI cliente_confirma:
        calendar.actualizar(cita_actual, seleccion)
        crm.registrar("cita modificada")
        enviar_confirmacion(cliente)
        audit("appointment_rescheduled")
        hablar("Perfecto, queda cambiado.")
```

## Reglas

- No cambiar cita sin confirmación.
- Si hay duda de identidad, verificar más.
- Si calendar falla, crear ticket.

## Tests de aceptación

- Cambio confirmado se refleja en calendario.
- CRM tiene nota.
- Cliente recibe confirmación.
