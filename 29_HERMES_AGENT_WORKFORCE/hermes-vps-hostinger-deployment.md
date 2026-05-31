# Despliegue Hermes Agent en VPS Hostinger

## Objetivo

Ejecutar Hermes Agent en el VPS de Hostinger como servicio persistente, aislado y mantenible.

## Requisitos mínimos recomendados

- VPS Linux, preferiblemente Ubuntu.
- 2 CPU cores o más.
- 8 GB RAM o más.
- Docker instalado.
- Acceso SSH con clave pública.
- Firewall configurado.
- Usuario no-root para operación diaria.

## Estructura recomendada en el VPS

```txt
/opt/aurion/
├── hermes/
│   ├── data/
│   ├── config/
│   ├── skills/
│   ├── memories/
│   ├── logs/
│   └── backups/
├── docker-compose.yml
└── README.md
```

## Regla de persistencia

Todo dato importante de Hermes debe vivir en un volumen montado. Nunca se debe guardar memoria, skills, sesiones o claves solamente dentro del contenedor.

## Flujo de instalación

```txt
1. Preparar VPS.
2. Instalar Docker.
3. Crear directorios persistentes.
4. Ejecutar setup de Hermes.
5. Configurar proveedor LLM.
6. Activar gateway solo si hace falta.
7. Añadir firewall.
8. Configurar backups.
9. Ejecutar prueba de conversación.
10. Registrar la instalación en documentación.
```

## Criterio de listo

Hermes está listo cuando puede responder, acceder solo a las herramientas permitidas, persistir memoria, reiniciarse sin pérdida de datos y generar logs verificables.
