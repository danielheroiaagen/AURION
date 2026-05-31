---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# User Personas

## 1. Cliente final

Persona que llama, escribe o habla con un avatar de una empresa.

### Necesidades

- Resolver rápido.
- No repetir información.
- Sentirse entendido.
- Recibir confirmación clara.

### Riesgos

- Frustración por respuestas robóticas.
- Desconfianza si el agente parece inventar.
- Abandono si la latencia es alta.

## 2. Administrador de empresa

Responsable de configurar AURION para su organización.

### Necesidades

- Cargar conocimiento.
- Configurar permisos.
- Revisar llamadas.
- Activar/desactivar herramientas.
- Ver métricas.

### Riesgos

- Miedo a perder control.
- Miedo a errores de IA.
- Falta de claridad en configuración.

## 3. Agente humano

Persona que recibe casos escalados por la IA.

### Necesidades

- Recibir resumen completo.
- Ver intención y urgencia.
- Ver acciones ya realizadas.
- Retomar sin pedir todo de nuevo.

## 4. Supervisor de calidad

Persona responsable de auditar atención y resultados.

### Necesidades

- Revisar llamadas.
- Filtrar por errores.
- Medir satisfacción.
- Detectar patrones.

## 5. Desarrollador/integrador

Persona que conecta AURION con sistemas externos.

### Necesidades

- APIs claras.
- Webhooks.
- SDKs.
- Documentación técnica.
- Entornos separados.

## 6. CEO/Director de operaciones del cliente

Decisor de compra.

### Necesidades

- Reducir coste.
- Mejorar disponibilidad.
- Aumentar ventas/resolución.
- Tener seguridad jurídica y trazabilidad.
