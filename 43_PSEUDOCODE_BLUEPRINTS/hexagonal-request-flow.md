# Flujo de request en arquitectura hexagonal

## Objetivo

Describir entrada y salida por puertos/adaptadores.

## Actores

- Inbound Adapter
- Application Port
- Use Case
- Domain
- Outbound Port
- Outbound Adapter

## Entradas

- Request externa
- Command interno

## Salidas

- Resultado interno
- Response externa

## Flujo humano

1. Adaptador transforma entrada.
2. Puerto invoca caso de uso.
3. Caso de uso aplica lógica.
4. Puerto de salida solicita infraestructura.
5. Adaptador externo ejecuta detalle.

## Pseudocódigo

```txt
EXTERNO: HTTP / Event / CLI / Voice Tool
    ↓
Inbound Adapter convierte a Command
    ↓
Application Use Case ejecuta intención
    ↓
Domain valida reglas
    ↓
Outbound Port solicita persistencia/API
    ↓
Outbound Adapter habla con PostgreSQL/CRM/Calendar
    ↓
Resultado vuelve hacia fuera
```

## Reglas

- La lógica vive dentro, los detalles fuera.
- Cambiar proveedor externo no cambia dominio.

## Tests de aceptación

- Se puede cambiar CRM adapter sin tocar caso de uso.
