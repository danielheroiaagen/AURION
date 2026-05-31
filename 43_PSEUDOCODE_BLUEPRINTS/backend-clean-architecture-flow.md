# Flujo backend Clean Architecture

## Objetivo

Definir cómo entra una petición al backend respetando capas.

## Actores

- Controller
- Use Case
- Domain Entity
- Port
- Adapter
- PostgreSQL

## Entradas

- Request HTTP/evento
- DTO
- Identidad

## Salidas

- Response
- Evento
- Auditoría

## Flujo humano

1. Controller valida formato.
2. Use Case ejecuta regla de aplicación.
3. Domain aplica invariantes.
4. Port define necesidad externa.
5. Adapter implementa persistencia.
6. Responder DTO.

## Pseudocódigo

```txt
HTTP Controller recibe request
    → valida DTO
    → llama UseCase.execute(command)

UseCase
    → carga entidades mediante RepositoryPort
    → ejecuta reglas de dominio
    → guarda cambios mediante RepositoryPort
    → emite eventos de dominio

Adapter PostgreSQL
    → traduce entidad a tabla
    → ejecuta transacción
    → devuelve resultado
```

## Reglas

- El dominio no importa frameworks.
- Los controladores no consultan PostgreSQL directo.
- Los adapters dependen de puertos, no al revés.

## Tests de aceptación

- Use case puede testearse sin DB.
- Dominio no contiene decoradores de framework.
