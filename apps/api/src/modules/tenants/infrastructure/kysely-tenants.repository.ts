import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';

import { TenantScopedDb } from '../../../database/tenant-scope';
import type { TenantsTable } from '../../../database/database.schema';
import type { Tenant, TenantsRepositoryPort } from '../application/tenants.repository.port';
import type { Selectable } from 'kysely';

function toTenant(row: Selectable<TenantsTable>): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Kysely adapter for the tenants port. All access runs inside
 * `TenantScopedDb.withTenant(tenantId, ...)`: the RLS policy on `tenants`
 * (`id = aurion_current_tenant_id()`) means a wrong or foreign id simply
 * yields no rows — cross-tenant access is structurally impossible here.
 */
@Injectable()
export class KyselyTenantsRepository implements TenantsRepositoryPort {
  constructor(private readonly db: TenantScopedDb) {}

  async findById(tenantId: string): Promise<Tenant | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('tenants')
        .selectAll()
        .where('id', '=', tenantId)
        .executeTakeFirst(),
    );
    return row ? toTenant(row) : null;
  }

  async updateSettings(
    tenantId: string,
    settings: Record<string, unknown>,
  ): Promise<Tenant | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .updateTable('tenants')
        .set({ settings: JSON.stringify(settings), updated_at: sql`now()` })
        .where('id', '=', tenantId)
        .returningAll()
        .executeTakeFirst(),
    );
    return row ? toTenant(row) : null;
  }
}
