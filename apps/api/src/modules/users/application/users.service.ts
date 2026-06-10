import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Page } from '../../../common/pagination/cursor';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
  type MembershipSettableStatus,
} from '../domain/membership';
import {
  USERS_REPOSITORY,
  type ListTenantUsersInput,
  type TenantUser,
  type UsersRepositoryPort,
} from './users.repository.port';

export interface InviteUserCommand {
  readonly email: string;
  readonly displayName: string;
  readonly role: AssignableRole;
}

export interface UpdateMembershipCommand {
  readonly role?: AssignableRole;
  readonly status?: MembershipSettableStatus;
}

/**
 * Users administration use cases (ADR-009 `/api/v1/users` group).
 *
 * Guard rails beyond RBAC:
 *  - `platform_owner` is never assignable through this API (domain rule).
 *  - An actor never modifies their OWN membership: privilege self-escalation
 *    and accidental self-lockout are both rejected at this layer.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly users: UsersRepositoryPort,
  ) {}

  async invite(tenantId: string, command: InviteUserCommand): Promise<TenantUser> {
    this.requireAssignableRole(command.role);
    return this.users.invite({
      tenantId,
      email: command.email,
      displayName: command.displayName,
      role: command.role,
    });
  }

  async getByUserId(tenantId: string, userId: string): Promise<TenantUser> {
    const user = await this.users.findByUserId(tenantId, userId);
    if (!user) {
      throw new NotFoundException('User is not a member of this tenant.');
    }
    return user;
  }

  async list(input: ListTenantUsersInput): Promise<Page<TenantUser>> {
    return this.users.list(input);
  }

  async updateMembership(
    actor: AuthenticatedActor,
    tenantId: string,
    membershipId: string,
    command: UpdateMembershipCommand,
  ): Promise<TenantUser> {
    if (command.role === undefined && command.status === undefined) {
      throw new BadRequestException('Provide at least one of "role" or "status".');
    }
    if (command.role !== undefined) {
      this.requireAssignableRole(command.role);
    }

    const membership = await this.users.findByMembershipId(tenantId, membershipId);
    if (!membership) {
      throw new NotFoundException('Membership not found in this tenant.');
    }
    if (actor.type === 'user' && membership.userId === actor.id) {
      throw new ForbiddenException('Actors cannot modify their own membership.');
    }

    const updated = await this.users.updateMembership(tenantId, membershipId, command);
    if (!updated) {
      throw new NotFoundException('Membership not found in this tenant.');
    }
    return updated;
  }

  private requireAssignableRole(role: string): void {
    if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
      throw new BadRequestException(
        `Role "${role}" is not assignable through the API. Assignable roles: ${ASSIGNABLE_ROLES.join(', ')}.`,
      );
    }
  }
}
