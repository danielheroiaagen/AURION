# Frontend Architecture

## Objetivo
Definir la arquitectura del frontend de AURION como consola SaaS empresarial, preparada para voz realtime, avatar, multi-tenant, panel administrativo y dashboards operativos.

## Stack oficial
- Next.js con App Router.
- React y TypeScript estricto.
- Tailwind CSS para estilos utilitarios.
- shadcn/ui como base de componentes accesibles.
- Recharts o alternativa controlada para visualizaciones.
- WebRTC/WebSocket para experiencias realtime.
- Arquitectura por features, no por capas visuales sueltas.

## Principios
1. El frontend no contiene reglas de negocio críticas.
2. El frontend consume casos de uso expuestos por APIs o SDKs internos.
3. La UI muestra estados claros: cargando, vacío, error, éxito, degradado y offline.
4. Cada pantalla debe estar diseñada para multi-tenant.
5. Toda acción peligrosa requiere confirmación, permisos y trazabilidad.

## Estructura recomendada
```txt
frontend/
  app/
    (public)/
    (auth)/
    (dashboard)/
    api/
  components/
    ui/
    layout/
    voice/
    avatar/
    dashboard/
  features/
    calls/
    agents/
    tenants/
    memory/
    tools/
    analytics/
    settings/
  lib/
    api/
    auth/
    realtime/
    telemetry/
    validation/
  styles/
  tests/
```

## Regla para agentes IA
Antes de crear una pantalla, el agente debe identificar:
- Usuario objetivo.
- Permisos necesarios.
- Estado de datos.
- Acción principal.
- Eventos de auditoría.
- Métricas asociadas.
