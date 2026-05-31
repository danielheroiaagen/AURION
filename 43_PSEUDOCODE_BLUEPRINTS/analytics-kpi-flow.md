# Flujo de analítica y KPIs

## Objetivo

Medir valor de negocio y rendimiento técnico.

## Actores

- Analytics Service
- PostgreSQL
- Event Store
- Dashboard
- Cliente

## Entradas

- Eventos
- Llamadas
- Resultados
- Costes

## Salidas

- KPIs
- Informes
- Alertas de negocio

## Flujo humano

1. Recolectar eventos.
2. Calcular métricas.
3. Agrupar por tenant.
4. Mostrar tendencias.
5. Detectar anomalías.

## Pseudocódigo

```txt
CADA hora:
    eventos = cargar_eventos_recientes()
    kpis = calcular([
        resolution_rate,
        escalation_rate,
        avg_latency,
        cost_per_call,
        customer_satisfaction
    ])
    guardar_kpis(kpis)
    SI anomalía(kpis):
        notificar_equipo()
```

## Reglas

- Separar métricas por tenant.
- No mezclar PII en analítica agregada.

## Tests de aceptación

- Dashboard muestra resolución y escalado.
- Anomalía genera alerta.
