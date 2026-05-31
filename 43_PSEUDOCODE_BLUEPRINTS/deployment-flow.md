# Flujo de despliegue

## Objetivo

Desplegar cambios con control y rollback.

## Actores

- Developer Agent
- CI/CD
- Test Suite
- Staging
- Production
- Human Approver

## Entradas

- PR
- Tests
- Artefacto

## Salidas

- Release
- Rollback disponible
- Changelog

## Flujo humano

1. Crear PR.
2. Ejecutar tests.
3. Build.
4. Deploy staging.
5. Smoke test.
6. Aprobación.
7. Deploy prod.
8. Monitorizar.

## Pseudocódigo

```txt
CUANDO PR aprobado:
    ejecutar_ci()
    SI tests_fallan:
        bloquear_deploy()
    build = crear_artefacto()
    deploy(staging, build)
    smoke = ejecutar_smoke_tests(staging)
    SI smoke.ok AND aprobacion_humana:
        deploy(production, build)
        monitorizar_release()
```

## Reglas

- Nunca desplegar sin tests.
- Producción requiere aprobación.

## Tests de aceptación

- Tests fallidos bloquean.
- Rollback está preparado.
