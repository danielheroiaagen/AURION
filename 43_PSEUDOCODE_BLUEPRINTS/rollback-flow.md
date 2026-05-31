# Flujo de rollback

## Objetivo

Revertir una release defectuosa con seguridad.

## Actores

- SRE
- CI/CD
- Production
- Database
- Monitoring

## Entradas

- Incidente
- Versión anterior
- Backups

## Salidas

- Servicio restaurado
- Incidente documentado

## Flujo humano

1. Detectar fallo.
2. Congelar despliegues.
3. Evaluar impacto DB.
4. Revertir app.
5. Revertir migración si aplica.
6. Validar.
7. Postmortem.

## Pseudocódigo

```txt
FUNC rollback(release):
    bloquear_nuevos_deploys()
    impacto = evaluar_impacto(release)
    deploy(version_anterior)
    SI release.incluye_migracion:
        ejecutar_plan_reversion_db()
    smoke_test_prod()
    documentar_incidente()
```

## Reglas

- No improvisar rollback de DB.
- Preservar logs.

## Tests de aceptación

- App vuelve a versión anterior.
- Incidente queda documentado.
