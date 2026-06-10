# AURION Database

La base de datos de AURION sigue `ADR-008`: PostgreSQL es la fuente de verdad y las migraciones son SQL-first.

Versión objetivo: **PostgreSQL 15+**. La migración MVP usa `ON DELETE SET NULL (column)` en claves foráneas compuestas para preservar `tenant_id` y limpiar solo la atribución de usuario cuando se elimina una membresía.

## Quick path

Aplicar todas las migraciones pendientes con el runner (ADR-012):

```bash
DATABASE_URL=postgres://... npm run db:migrate
DATABASE_URL=postgres://... npm run db:status
```

El runner registra cada archivo aplicado en la tabla `schema_migrations`
(nombre + checksum SHA-256 + fecha). Las migraciones ya aplicadas se saltan;
si el contenido de una migración aplicada cambia, el runner aborta: la
historia es inmutable, se añade una migración nueva. Un advisory lock
serializa despliegues concurrentes. Nunca se ejecuta en el arranque de la API.

Revertir una migración en entorno controlado (manual, revisado):

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

## Tenant isolation contract (Row-Level Security)

Desde la migración `0002`, el aislamiento multi-tenant se aplica **también a nivel de base de datos** con Row-Level Security (RLS), no solo en código de aplicación (ver `ADR-007`).

La capa de aplicación debe establecer el contexto de tenant **por transacción** antes de tocar tablas tenant-owned:

```sql
SET LOCAL app.tenant_id = '<tenant-uuid>';
```

- Si el contexto no se establece, las policies evalúan a falso y el resultado seguro es "cero filas", no "todas las filas".
- `audit_events` es **append-only**: un trigger bloquea `UPDATE`/`DELETE` independientemente del rol.
- Operaciones de plataforma (cross-tenant) usan un rol con `BYPASSRLS` provisionado en infraestructura, no en migraciones.

## Current migrations

| Migration | Purpose |
|-----------|---------|
| `2026-06-01-0001-create-mvp-core.up.sql` | Crea el schema MVP: tenants, users, memberships, knowledge, voice sessions, controlled actions y audit. |
| `2026-06-01-0001-create-mvp-core.down.sql` | Revierte el schema MVP en orden seguro. |
| `2026-06-10-0002-security-rls-audit-hardening.up.sql` | Activa RLS por tenant en todas las tablas tenant-owned y hace `audit_events` append-only. |
| `2026-06-10-0002-security-rls-audit-hardening.down.sql` | Revierte RLS, el trigger append-only y las funciones helper. |
