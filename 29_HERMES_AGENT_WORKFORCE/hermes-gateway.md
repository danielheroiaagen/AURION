# Hermes Gateway

## Propósito

Permitir interacción con Hermes desde canales externos sin depender del terminal.

## Canales posibles

- Telegram.
- Discord.
- Slack.
- WhatsApp.
- Email.
- API compatible.

## Uso en AURION

El gateway se usará solo para coordinación interna, no para atender clientes finales salvo diseño explícito.

## Reglas

- Activar allowlist de usuarios.
- No abrir gateway a internet sin autenticación fuerte.
- Registrar comandos importantes.
- Separar canales personales de canales de producción.
- Limitar herramientas disponibles desde gateway.

## Flujo seguro

```txt
Usuario autorizado envía tarea
→ Gateway valida identidad
→ Hermes interpreta intención
→ Se comprueban herramientas permitidas
→ Ejecuta o propone
→ Guarda resumen y resultado
```
