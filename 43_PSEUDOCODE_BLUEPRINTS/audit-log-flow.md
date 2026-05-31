# Flujo de auditoría

## Objetivo

Registrar acciones importantes de forma consultable.

## Actores

- Service
- Audit Logger
- PostgreSQL
- Admin Dashboard

## Entradas

- Actor
- Acción
- Target
- Resultado

## Salidas

- Evento auditado
- Consulta posterior

## Flujo humano

1. Capturar actor.
2. Capturar acción.
3. Capturar target.
4. Ocultar secretos.
5. Guardar evento.
6. Exponer en dashboard.

## Pseudocódigo

```txt
FUNC auditar(actor, action, target, metadata):
    metadata_segura = eliminar_secretos(metadata)
    evento = AuditEvent(actor, action, target, metadata_segura, now())
    audit_repository.save(evento)
```

## Reglas

- Nunca guardar secretos en logs.
- Toda acción sobre datos debe auditarse.

## Tests de aceptación

- Log no contiene API key.
- Cambio CRM queda registrado.
