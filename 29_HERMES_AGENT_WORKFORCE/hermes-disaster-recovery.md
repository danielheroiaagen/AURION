# Disaster Recovery Hermes

## Escenarios

- VPS caído.
- Contenedor corrupto.
- Volumen dañado.
- API key revocada.
- Skill defectuosa.
- MCP comprometido.
- Gateway expuesto.

## Prioridad de recuperación

1. Aislar riesgo.
2. Preservar evidencia.
3. Restaurar servicio interno.
4. Validar integridad.
5. Revisar causa raíz.
6. Actualizar runbook.

## RTO/RPO inicial

```txt
RTO: 4 horas.
RPO: 24 horas.
```

## Regla

Hermes puede caer sin tumbar AURION producción. La fuerza laboral IA no debe ser dependencia crítica del runtime de clientes.
