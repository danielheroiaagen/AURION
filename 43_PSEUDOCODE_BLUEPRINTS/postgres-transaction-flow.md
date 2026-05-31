# Flujo de transacción PostgreSQL

## Objetivo

Asegurar consistencia al modificar datos.

## Actores

- Use Case
- Unit of Work
- Repository
- PostgreSQL
- Audit Service

## Entradas

- Command
- Entidades
- Cambios

## Salidas

- Commit
- Rollback
- Evento auditado

## Flujo humano

1. Abrir transacción.
2. Leer datos con bloqueo si procede.
3. Validar invariantes.
4. Guardar cambios.
5. Guardar auditoría.
6. Commit o rollback.

## Pseudocódigo

```txt
FUNC ejecutar_con_transaccion(command):
    BEGIN TRANSACTION
    TRY:
        entidad = repo.find(command.id, lock=True)
        entidad.aplicar(command)
        repo.save(entidad)
        audit_repo.save(evento_auditoria)
        COMMIT
    CATCH error:
        ROLLBACK
        lanzar_error_controlado(error)
```

## Reglas

- Auditoría debe estar en la misma transacción cuando sea crítica.
- Usar rollback ante error.

## Tests de aceptación

- Fallo al guardar hace rollback.
- Cambio y auditoría se guardan juntos.
