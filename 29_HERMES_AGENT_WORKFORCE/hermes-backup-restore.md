# Backup y restauración Hermes

## Objetivo

Evitar pérdida de memoria, skills y configuración.

## Qué respaldar

- Volumen persistente.
- Configuración no secreta.
- Skills aprobadas.
- Memories permitidas.
- Runbooks.
- Logs críticos.

## Qué no guardar en backups sin cifrar

- API keys.
- Tokens.
- Credenciales.
- Información sensible de clientes.

## Frecuencia

```txt
Diario: backup incremental.
Semanal: backup completo.
Mensual: prueba de restauración.
```

## Prueba de restauración

```txt
1. Crear entorno temporal.
2. Restaurar volumen.
3. Iniciar Hermes.
4. Validar configuración.
5. Validar skills.
6. Validar memoria.
7. Documentar resultado.
```
