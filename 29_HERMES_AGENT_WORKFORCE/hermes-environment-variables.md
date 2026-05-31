# Variables de entorno Hermes

## Propósito

Definir cómo gestionar variables, proveedores y secretos.

## Reglas de seguridad

- Las API keys nunca se escriben en documentación.
- Las API keys nunca se suben a Git.
- `.env` debe estar en `.gitignore`.
- Rotar claves si aparecen en logs.
- Separar claves de dev, staging y producción.

## Variables típicas

```txt
LLM_PROVIDER=<provider>
OPENAI_API_KEY=<secret>
OPENROUTER_API_KEY=<secret>
ANTHROPIC_API_KEY=<secret>
HERMES_DASHBOARD=0
HERMES_GATEWAY_ALLOWED_USERS=<ids>
```

## Política de acceso

Solo DevOps/Security puede modificar secrets del VPS. Los agentes pueden solicitar cambios, pero no leer claves completas.
