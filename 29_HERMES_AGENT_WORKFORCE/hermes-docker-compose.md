# Docker Compose para Hermes Agent

## Propósito

Definir la forma estándar de levantar Hermes Agent en infraestructura AURION.

## docker-compose base recomendado

```yaml
services:
  hermes:
    image: nousresearch/hermes-agent:latest
    container_name: aurion-hermes
    restart: unless-stopped
    volumes:
      - ./hermes/data:/opt/data
    ports:
      - "127.0.0.1:8642:8642"
    environment:
      - TZ=Europe/Madrid
    command: ["gateway", "run"]
```

## Reglas

- Exponer puertos solo en localhost salvo necesidad real.
- Usar reverse proxy con TLS si se necesita acceso externo.
- No montar `/` ni directorios sensibles del host.
- No ejecutar como root si puede evitarse.
- Mantener backup del volumen.

## Comandos operativos

```bash
docker compose up -d
docker compose logs -f hermes
docker compose pull hermes
docker compose restart hermes
```

## Actualización segura

```txt
1. Backup del volumen.
2. Pull de nueva imagen.
3. Levantar staging si existe.
4. Smoke test.
5. Reiniciar producción.
6. Verificar memoria, skills y gateway.
```
