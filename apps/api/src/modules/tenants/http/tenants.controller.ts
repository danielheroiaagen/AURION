import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { TenantsService } from '../application/tenants.service';
import { toTenantResponse, UpdateTenantSettingsDto, type TenantResponse } from './tenants.dto';

/**
 * Tenant administration (ADR-009 `/api/v1/tenants`).
 *
 * The `:tenantId` path parameter is the policy guard's explicit resource
 * tenant: a token for another tenant is denied as `cross_tenant` before this
 * controller runs, and RLS yields no rows even if policy were bypassed.
 */
@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get(':tenantId')
  @RequirePermission('tenant:read')
  @ApiOperation({ summary: "Read the actor's own tenant." })
  async getTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<TenantResponse> {
    return toTenantResponse(await this.tenants.getById(tenantId));
  }

  @Patch(':tenantId/settings')
  @RequirePermission('tenant:settings:update')
  @ApiOperation({ summary: 'Replace the tenant settings document.' })
  async updateSettings(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: UpdateTenantSettingsDto,
  ): Promise<TenantResponse> {
    return toTenantResponse(await this.tenants.updateSettings(tenantId, body.settings));
  }
}
