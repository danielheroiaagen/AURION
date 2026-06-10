import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { requireActorTenant } from '../../../common/http/actor-tenant';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { UsersService } from '../application/users.service';
import { toTenantUserResponse, UpdateMembershipDto, type TenantUserResponse } from './users.dto';

/**
 * Membership administration (ADR-009 `/api/v1/memberships`).
 *
 * Role and status changes are sensitive (`user:manage` leaves audit
 * evidence); the use case additionally rejects self-modification and the
 * `platform_owner` role.
 */
@ApiTags('memberships')
@ApiBearerAuth()
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly users: UsersService) {}

  @Patch(':id')
  @RequirePermission('user:manage')
  @ApiOperation({ summary: "Change a membership's role and/or status (never your own)." })
  async update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMembershipDto,
  ): Promise<TenantUserResponse> {
    return toTenantUserResponse(
      await this.users.updateMembership(actor, requireActorTenant(actor), id, {
        role: body.role,
        status: body.status,
      }),
    );
  }
}
