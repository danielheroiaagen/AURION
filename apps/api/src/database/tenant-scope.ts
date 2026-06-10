import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql, type Transaction } from 'kysely';

import type { Database } from './database.schema';
import { KYSELY } from './database.tokens';

/**
 * The only gateway to tenant-owned tables (ADR-012).
 *
 * Every callback runs inside a transaction whose first statement sets the
 * transaction-local `app.tenant_id` GUC through a parameterized `set_config`
 * call — the programmatic form of `SET LOCAL app.tenant_id = '<uuid>'` that
 * migration 0002's RLS policies key on. Because the GUC is transaction-local,
 * pooled connections can never leak a tenant context between requests, and
 * because repositories only receive the transaction handle, there is no code
 * path that touches tenant-owned tables outside a tenant scope.
 */
@Injectable()
export class TenantScopedDb {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async withTenant<T>(
    tenantId: string,
    fn: (trx: Transaction<Database>) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      return fn(trx);
    });
  }
}
