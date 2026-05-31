# Auditoría de acciones Hermes

## Objetivo

Saber qué hizo cada agente, cuándo, por qué y con qué resultado.

## Eventos auditables

- Tarea creada.
- Tool call ejecutado.
- MCP usado.
- Archivo modificado.
- Skill creada.
- Memoria actualizada.
- Propuesta de despliegue.
- Error detectado.
- Acción bloqueada por seguridad.

## Formato recomendado

```json
{
  "timestamp": "ISO-8601",
  "agent": "Backend Platform Agent",
  "action": "write_file",
  "target": "backend/src/...",
  "reason": "Implementar caso de uso aprobado",
  "risk_level": "medium",
  "result": "success"
}
```

## Regla

Lo que no se audita no existe para una empresa seria.
