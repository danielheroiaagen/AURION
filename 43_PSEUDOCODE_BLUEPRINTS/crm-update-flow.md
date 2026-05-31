# Flujo de actualización CRM

## Objetivo

Actualizar datos de cliente con confirmación y auditoría.

## Actores

- Cliente
- Voice Agent
- CRM Adapter
- Permission Service
- Audit Service

## Entradas

- Dato nuevo
- Cliente identificado
- Permiso

## Salidas

- CRM actualizado
- Cambio rechazado
- Confirmación

## Flujo humano

1. Identificar cliente.
2. Verificar permiso.
3. Confirmar dato nuevo.
4. Actualizar CRM.
5. Auditar antes/después si procede.
6. Confirmar.

## Pseudocódigo

```txt
FUNC actualizar_crm(cliente, campo, valor):
    validar_identidad(cliente)
    permiso = validar_permiso("crm.update", campo)
    SI permiso.denegado:
        return rechazar()

    confirmar("Voy a actualizar " + campo + " a " + valor)
    crm.update(cliente.id, campo, valor)
    audit("crm_updated", campo)
    responder("Datos actualizados.")
```

## Reglas

- No actualizar datos sin confirmar.
- Campos sensibles requieren verificación reforzada.

## Tests de aceptación

- Email cambia solo con confirmación.
- Campo no permitido se bloquea.
