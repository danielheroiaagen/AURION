# Flujo de eventos internos

## Objetivo

Desacoplar acciones secundarias del caso de uso principal.

## Actores

- Use Case
- Domain Event
- Event Bus
- Handlers
- Adapters

## Entradas

- Evento de dominio
- Metadatos

## Salidas

- Handlers ejecutados
- Logs
- Reintentos

## Flujo humano

1. Crear evento.
2. Publicar evento.
3. Handlers escuchan.
4. Ejecutar efectos secundarios.
5. Registrar resultado.

## Pseudocódigo

```txt
CUANDO cita_creada:
    event_bus.publish(AppointmentCreated)

HANDLER enviar_email_confirmacion(event):
    email_adapter.send(event.cliente, event.detalles)

HANDLER actualizar_analytics(event):
    metrics.increment("appointments.created")
```

## Reglas

- No meter efectos secundarios lentos en el caso de uso principal.
- Eventos deben ser idempotentes.

## Tests de aceptación

- Email puede fallar sin romper creación de cita si no es crítico.
