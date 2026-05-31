# Flujo supervisor call center

## Objetivo

Permitir supervisión de llamadas y escalados.

## Actores

- Supervisor
- Dashboard
- Voice Runtime
- Queue Service

## Entradas

- Llamadas activas
- Alertas
- Cola

## Salidas

- Intervención
- Transferencia
- Notas

## Flujo humano

1. Ver llamadas activas.
2. Detectar llamadas en riesgo.
3. Abrir resumen vivo.
4. Intervenir si procede.
5. Guardar nota.

## Pseudocódigo

```txt
AL supervisor_abre_panel:
    llamadas = listar_llamadas_activas(tenant)
    riesgos = filtrar(llamadas, condicion="riesgo_alto")
    mostrar(llamadas, riesgos)

SI supervisor_interviene:
    pausar_agente_o_transferir()
    registrar_intervencion()
```

## Reglas

- Supervisor solo ve tenants autorizados.
- Intervención queda auditada.

## Tests de aceptación

- Llamada de riesgo se marca.
- Transferencia se registra.
