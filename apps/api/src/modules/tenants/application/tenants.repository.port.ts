import type { TenantStatus } from '../../../database/database.schema';

/** Tenant as the application layer sees it — framework- and database-free. */
export interface Tenant {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: TenantStatus;
  readonly settings: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Outbound port for tenant persistence (ADR-001 hexagonal boundary). Every
 * implementation must scope access to the given tenant — with the Kysely
 * adapter that means running inside `TenantScopedDb.withTenant`, where RLS is
 * the hard guarantee.
 */
export interface TenantsRepositoryPort {
  findById(tenantId: string): Promise<Tenant | null>;
  /** Replaces the tenant's `settings` document; returns the updated tenant. */
  updateSettings(tenantId: string, settings: Record<string, unknown>): Promise<Tenant | null>;
}

/** DI token for the tenants repository port. */
export const TENANTS_REPOSITORY = Symbol('TENANTS_REPOSITORY');
