import { Module } from '@nestjs/common';

import { TENANTS_REPOSITORY } from './application/tenants.repository.port';
import { TenantsService } from './application/tenants.service';
import { KyselyTenantsRepository } from './infrastructure/kysely-tenants.repository';
import { TenantsController } from './http/tenants.controller';

/** Tenant administration contract group (ADR-009, ADR-012). */
@Module({
  controllers: [TenantsController],
  providers: [
    TenantsService,
    { provide: TENANTS_REPOSITORY, useClass: KyselyTenantsRepository },
  ],
})
export class TenantsModule {}
