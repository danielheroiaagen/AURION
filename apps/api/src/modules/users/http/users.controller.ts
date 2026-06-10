import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { requireActorTenant } from '../../../common/http/actor-tenant';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { UsersService } from '../application/users.service';
import {
  InviteUserDto,
  ListUsersQueryDto,
  toTenantUserListResponse,
  toTenantUserResponse,
  type TenantUserListResponse,
  type TenantUserResponse,
} from './users.dto';

/**
 * Users administration (ADR-009 `/api/v1/users`).
 *
 * All routes operate on the actor's own tenant: the global `users` table is
 * only ever reached through the RLS-protected membership join, so identities
 * without a membership in this tenant do not exist as far as this API is
 * concerned.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @RequirePermission('user:manage')
  @ApiOperation({ summary: "Invite a user into the actor's tenant with a role." })
  async invite(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() body: InviteUserDto,
  ): Promise<TenantUserResponse> {
    return toTenantUserResponse(
      await this.users.invite(requireActorTenant(actor), {
        email: body.email,
        displayName: body.display_name,
        role: body.role,
      }),
    );
  }

  @Get()
  @RequirePermission('user:read')
  @ApiOperation({ summary: 'List the tenant members (cursor pagination).' })
  async list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListUsersQueryDto,
  ): Promise<TenantUserListResponse> {
    const page = await this.users.list({
      tenantId: requireActorTenant(actor),
      role: query.role,
      membershipStatus: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return toTenantUserListResponse(page);
  }

  @Get(':userId')
  @RequirePermission('user:read')
  @ApiOperation({ summary: 'Read one tenant member by user id.' })
  async getByUserId(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<TenantUserResponse> {
    return toTenantUserResponse(
      await this.users.getByUserId(requireActorTenant(actor), userId),
    );
  }
}
