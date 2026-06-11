---
project: AURION
document: Client Onboarding Playbook (call-forwarding model)
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: active
created_at: 2026-06-11
---

# Onboarding del cliente — modelo de DESVÍO de número

Decisión de negocio (2026-06-11): AURION no compra números ni se da de
alta como autónomo hasta el PRIMER cliente real. El modelo es **el
cliente desvía su número de empresa a AURION**.

## El matiz de coste (importante)

El desvío de llamadas lo cobra la operadora de ORIGEN. Por eso el número
de DESTINO importa:

- destino **español** → desvío nacional, barato (céntimos/min o incluido).
- destino **+1 US** (el actual de pruebas) → desvío INTERNACIONAL, caro
  para el cliente. **No usar con clientes reales.**

Conclusión: para producción con un cliente español hace falta un número
de destino español. Se saca CUANDO llega el primer cliente, con la
documentación de ese momento (la del cliente o el alta de Daniel) — no
antes. El número US de pruebas (+1 814 936 2930) vale solo para DEMOS.

## Camino para el primer cliente (cuando llegue)

1. Número español de destino — la opción más limpia:
   - el cliente ya tiene su número de empresa → lo desvía a un número
     español que sacamos en Twilio (bundle regulatorio aprobado: DNI o
     CIF + dirección ES, 1-3 días), o
   - el cliente nos da acceso a su propio número (algunas operadoras y
     centralitas virtuales permiten apuntar el desvío/SIP directamente).
2. Apuntar ese número a AURION: en Twilio, `voiceUrl =
   https://aurion.inteligenciaartificial.pw/twiml` (POST). Cero código.
3. Multi-tenant: HOY todo número entra al tenant de Daniel. Para que el
   segundo cliente tenga SU tenant/conocimiento/acciones hace falta el
   enrutado número→tenant (fase pendiente, se activa con el 2º cliente).
4. Saludo y conocimiento por cliente: `PHONE_GREETING` y la base de
   conocimiento del tenant — configurables sin desplegar.

## Para vender ANTES de tener número español

- Demos en vivo con el número US actual (en la demo importa el producto,
  no el número).
- El widget de voz web (`apps/widget`) es una demo embebible sin
  teléfono: el prospecto habla con AURION desde el navegador.
