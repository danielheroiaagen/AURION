import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  TENANTS_REPOSITORY,
  type Tenant,
  type TenantsRepositoryPort,
} from './tenants.repository.port';

/**
 * Tenant administration use cases (ADR-009 "Tenant administration" group).
 * Authorization happens before this layer (policy guard); persistence behind
 * the repository port. This service owns only resource semantics.
 */
@Injectable()
export class TenantsService {
  constructor(
    @Inject(TENANTS_REPOSITORY) private readonly tenants: TenantsRepositoryPort,
  ) {}

  async getById(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenants.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
    return tenant;
  }

  async updateSettings(tenantId: string, settings: Record<string, unknown>): Promise<Tenant> {
    const tenant = await this.tenants.updateSettings(tenantId, settings);
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
    return tenant;
  }
}
