# Kanban Workflow para Hermes

## Columnas obligatorias

```txt
Inbox
Ready
In Progress
Review
Blocked
Approved
Done
Archived
```

## Política

- Una tarea sin documentos de referencia no pasa a Ready.
- Una tarea sin tests no pasa a Approved.
- Una tarea crítica sin revisión humana no pasa a Done.

## Campos mínimos

```txt
id
title
owner_agent
context_docs
risk_level
inputs
outputs
definition_of_done
reviewer
status
```

## Regla de enfoque

Un agente no debe abrir diez frentes. Mejor una tarea terminada y revisada que veinte ideas a medias.
