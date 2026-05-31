# Hexagonal + Clean Architecture Guide

## Objetivo
AURION usará arquitectura hexagonal combinada con Clean Architecture para separar dominio, aplicación, infraestructura e interfaces.

## Capas oficiales
```txt
backend/
  src/
    domain/
      entities/
      value-objects/
      domain-events/
      repositories/
      services/
    application/
      use-cases/
      ports/
      dto/
      policies/
    infrastructure/
      postgres/
      redis/
      queues/
      external-apis/
      llm-providers/
      telephony/
    interfaces/
      http/
      websocket/
      workers/
      cli/
```

## Dependencias permitidas
- `domain` no depende de nada externo.
- `application` depende de `domain` y define puertos.
- `infrastructure` implementa puertos.
- `interfaces` adapta HTTP, WebSocket, workers o CLI hacia casos de uso.

## Prohibiciones
- No importar ORM dentro del dominio.
- No llamar APIs externas desde entidades.
- No mezclar controladores con lógica de negocio.
- No crear servicios genéricos tipo `manager` sin responsabilidad clara.
- No acceder directamente a PostgreSQL desde controladores.

## Ejemplo de flujo
1. Controller recibe petición.
2. Valida DTO.
3. Invoca caso de uso.
4. Caso de uso consulta puerto/repository.
5. Infraestructura implementa PostgreSQL/Redis/API externa.
6. Caso de uso devuelve resultado.
7. Controller transforma respuesta.

## Regla para IA
Si un agente no sabe en qué capa poner código, debe detenerse y documentar la decisión antes de implementarla.
