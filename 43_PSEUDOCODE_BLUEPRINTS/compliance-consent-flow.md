# Flujo de consentimiento y cumplimiento

## Objetivo

Gestionar consentimiento para grabación, datos y uso de IA.

## Actores

- Cliente
- Voice Agent
- Consent Service
- Audit Service

## Entradas

- Canal
- Tenant
- Política legal

## Salidas

- Consentimiento aceptado
- Rechazo
- Registro

## Flujo humano

1. Informar al cliente.
2. Solicitar consentimiento si aplica.
3. Registrar decisión.
4. Adaptar flujo según decisión.

## Pseudocódigo

```txt
FUNC gestionar_consentimiento(cliente, tenant, canal):
    politica = cargar_politica_consentimiento(tenant, canal)
    SI politica.requiere_aviso:
        informar(politica.mensaje)
    SI politica.requiere_aceptacion:
        respuesta = pedir_aceptacion()
        registrar_consentimiento(cliente, respuesta)
        SI respuesta == NO:
            activar_flujo_sin_grabacion_o_escalar()
```

## Reglas

- Cumplir política por país/sector.
- Registrar consentimiento con fecha.

## Tests de aceptación

- Cliente puede rechazar grabación.
- Sistema adapta flujo.
