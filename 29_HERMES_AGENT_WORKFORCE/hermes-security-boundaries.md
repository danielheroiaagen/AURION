# Límites de seguridad Hermes

## Objetivo

Impedir que un agente con herramientas se convierta en un riesgo operativo.

## Límites obligatorios

- Sandbox para comandos.
- Allowlist de usuarios del gateway.
- Firewall en VPS.
- Sin acceso directo a secretos.
- Sin permisos root permanentes.
- Sin escritura en producción por defecto.
- Backups cifrados.
- Logs de acciones.

## Comandos de alto riesgo

```txt
rm -rf
chmod/chown masivos
curl | sh
modificación de firewall
modificación de usuarios SSH
borrado de bases de datos
migraciones destructivas
```

## Política

Cualquier comando de alto riesgo debe convertirse en propuesta revisable, no ejecutarse automáticamente.
