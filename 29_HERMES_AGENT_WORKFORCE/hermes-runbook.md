# Runbook operativo Hermes

## Arranque

```bash
cd /opt/aurion
docker compose up -d hermes
docker compose logs -f hermes
```

## Parada

```bash
docker compose stop hermes
```

## Reinicio

```bash
docker compose restart hermes
```

## Backup manual

```bash
tar -czf backups/hermes-$(date +%F).tar.gz hermes/data
```

## Diagnóstico

```txt
1. Ver contenedor.
2. Ver logs.
3. Ver disco.
4. Ver memoria.
5. Probar CLI.
6. Probar gateway.
7. Probar herramientas.
```

## Incidente

Si Hermes ejecuta algo sospechoso:

```txt
1. Detener gateway.
2. Revocar tokens afectados.
3. Preservar logs.
4. Desactivar herramientas.
5. Revisar memoria y skills recientes.
6. Documentar incidente.
```
