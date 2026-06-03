# AURION Database

La base de datos de AURION sigue `ADR-008`: PostgreSQL es la fuente de verdad y las migraciones son SQL-first.

Versión objetivo: **PostgreSQL 15+**. La migración MVP usa `ON DELETE SET NULL (column)` en claves foráneas compuestas para preservar `tenant_id` y limpiar solo la atribución de usuario cuando se elimina una membresía.

## Quick path

Aplicar una migración:

```bash
psql "$DATABASE_URL" -f database/migrations/2026-06-01-0001-create-mvp-core.up.sql
```

Revertir una migración en entorno controlado:

```bash
psql "$DATABASE_URL" -f database/migrations/2026-06-01-0001-create-mvp-core.down.sql
```

## Rules

- Los archivos `up.sql` crean o modifican schema.
- Los archivos `down.sql` revierten en orden inverso.
- No usamos auto-sync ni schema push desde la API.
- Todo cambio se revisa en PR como código crítico.
- Las tablas de cliente deben tener `tenant_id`.
- Las atribuciones de usuario en datos tenant-owned deben validar `(tenant_id, user_id)` contra `tenant_memberships`.

## Current migrations

| Migration | Purpose |
|-----------|---------|
| `2026-06-01-0001-create-mvp-core.up.sql` | Crea el schema MVP: tenants, users, memberships, knowledge, voice sessions, controlled actions y audit. |
| `2026-06-01-0001-create-mvp-core.down.sql` | Revierte el schema MVP en orden seguro. |
