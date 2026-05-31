---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# PRD — Product Requirements Document

## Producto

AURION: plataforma empresarial de agentes de voz, IVR inteligente, acciones realtime y telepresencia/avatar para atención al cliente, ventas y soporte.

## Objetivo del producto

Permitir que una empresa configure agentes capaces de atender conversaciones naturales, consultar conocimiento, ejecutar acciones autorizadas y registrar todo el proceso de forma auditable.

## Problemas del usuario

### Cliente final

- No quiere esperar.
- No quiere repetir información.
- Quiere resolver su problema en una sola interacción.
- Quiere hablar de forma natural.

### Empresa

- Tiene volumen alto de llamadas repetitivas.
- Necesita reducir coste operativo sin perder calidad.
- Quiere atención 24/7.
- Necesita trazabilidad.
- Quiere integrar IA con sus sistemas.

### Equipo humano

- Está saturado con preguntas repetitivas.
- Necesita mejores resúmenes y contexto antes de intervenir.
- Quiere que la IA escale solo cuando corresponde.

## Alcance funcional inicial completo

- Autenticación y multi-tenant.
- Configuración de empresa.
- Base de conocimiento.
- Agente de voz realtime.
- WebRTC para navegador.
- SIP para telefonía.
- Herramientas de acción.
- Registro de conversaciones.
- Resumen automático.
- Escalado humano.
- Panel de control.
- Evaluación de calidad.
- Módulo avatar.
- Hermes Agent workforce.

## Historias de usuario principales

### Cliente final

Como cliente, quiero llamar y explicar mi problema en lenguaje natural para no navegar menús.

Como cliente, quiero que el agente recuerde mi caso para no repetir información.

Como cliente, quiero que el agente pueda cambiar una cita o crear una solicitud sin pasarme a otra persona.

### Administrador de empresa

Como administrador, quiero subir documentos y políticas para que el agente responda con información aprobada.

Como administrador, quiero definir qué acciones puede ejecutar el agente.

Como administrador, quiero revisar llamadas, transcripciones y acciones ejecutadas.

### Supervisor

Como supervisor, quiero ver métricas de resolución, satisfacción, latencia y errores.

Como supervisor, quiero detectar llamadas donde la IA falló o escaló tarde.

### Desarrollador

Como desarrollador, quiero crear herramientas mediante puertos/adaptadores sin modificar el dominio.

Como desarrollador, quiero tener logs, trazas y tests para cada flujo crítico.

## Requisitos no funcionales

- Latencia baja en voz.
- Seguridad por defecto.
- Arquitectura modular.
- Multi-tenant desde diseño.
- Auditoría completa.
- Soporte para rollback.
- Observabilidad por conversación.
- Datos cifrados en tránsito y reposo.
- Dominio independiente de frameworks.

## KPIs

- Resolución autónoma.
- Tasa de escalado correcta.
- Latencia de primera respuesta.
- Tiempo medio de resolución.
- Tasa de acciones exitosas.
- Coste por conversación.
- CSAT/NPS.
- Incidencias por 1.000 conversaciones.

## Fuera de alcance inicial

- Automatización sin aprobación de acciones críticas.
- Entrenamiento de modelos propios desde cero.
- Sustitución total de humanos en casos sensibles.
- Integraciones ilimitadas sin priorización.

## Criterios de aceptación globales

- Todo flujo crítico tiene tests.
- Toda acción queda auditada.
- Todo dato sensible tiene política de acceso.
- Toda decisión técnica relevante tiene ADR.
- El agente escala cuando no tiene certeza suficiente.
