import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

import type { Tenant } from '../application/tenants.repository.port';

export class UpdateTenantSettingsDto {
  @ApiProperty({
    description: 'Full replacement for the tenant settings document.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  settings!: Record<string, unknown>;
}

/** Stable response shape (ADR-009): snake_case, ISO-8601 timestamps. */
export interface TenantResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function toTenantResponse(tenant: Tenant): TenantResponse {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    settings: tenant.settings,
    created_at: tenant.createdAt.toISOString(),
    updated_at: tenant.updatedAt.toISOString(),
  };
}
