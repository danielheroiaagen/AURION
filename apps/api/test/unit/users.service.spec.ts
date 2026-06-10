import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { Page } from '../../src/common/pagination/cursor';
import type { AuthenticatedActor } from '../../src/modules/auth/domain/actor';
import type {
  InviteUserInput,
  ListTenantUsersInput,
  TenantUser,
  UpdateMembershipFields,
  UsersRepositoryPort,
} from '../../src/modules/users/application/users.repository.port';
import { UsersService } from '../../src/modules/users/application/users.service';
import { ASSIGNABLE_ROLES } from '../../src/modules/users/domain/membership';

const TENANT = '11111111-1111-4111-8111-111111111111';
const MEMBERSHIP_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

const adminActor: AuthenticatedActor = {
  id: 'admin-1',
  tenantId: TENANT,
  type: 'user',
  role: 'tenant_admin',
};

function tenantUser(overrides: Partial<TenantUser> = {}): TenantUser {
  return {
    id: MEMBERSHIP_ID,
    tenantId: TENANT,
    userId: USER_ID,
    email: 'ana@initech.test',
    displayName: 'Ana',
    userStatus: 'invited',
    role: 'supervisor',
    membershipStatus: 'active',
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
    ...overrides,
  };
}

class FakeRepo implements UsersRepositoryPort {
  invited: InviteUserInput | null = null;
  byUserId: TenantUser | null = null;
  byMembershipId: TenantUser | null = null;
  updateResult: TenantUser | null = null;
  lastUpdate: [string, string, UpdateMembershipFields] | null = null;

  async invite(input: InviteUserInput): Promise<TenantUser> {
    this.invited = input;
    return tenantUser({ role: input.role, email: input.email });
  }

  async findByUserId(): Promise<TenantUser | null> {
    return this.byUserId;
  }

  async findByMembershipId(): Promise<TenantUser | null> {
    return this.byMembershipId;
  }

  async list(_input: ListTenantUsersInput): Promise<Page<TenantUser>> {
    return { items: [tenantUser()], nextCursor: null };
  }

  async updateMembership(
    tenantId: string,
    membershipId: string,
    fields: UpdateMembershipFields,
  ): Promise<TenantUser | null> {
    this.lastUpdate = [tenantId, membershipId, fields];
    return this.updateResult;
  }
}

describe('membership domain', () => {
  it('platform_owner is never assignable through the API', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('platform_owner');
  });
});

describe('UsersService', () => {
  let repo: FakeRepo;
  let service: UsersService;

  beforeEach(() => {
    repo = new FakeRepo();
    service = new UsersService(repo);
  });

  it('invites a user with an assignable role', async () => {
    const invited = await service.invite(TENANT, {
      email: 'ana@initech.test',
      displayName: 'Ana',
      role: 'supervisor',
    });
    expect(invited.role).toBe('supervisor');
    expect(repo.invited).toMatchObject({ tenantId: TENANT, email: 'ana@initech.test' });
  });

  it('rejects non-assignable roles at the use-case layer too', async () => {
    await expect(
      service.invite(TENANT, {
        email: 'evil@initech.test',
        displayName: 'Evil',
        role: 'platform_owner' as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.invited).toBeNull();
  });

  it('404s when reading a user without a membership in this tenant', async () => {
    repo.byUserId = null;
    await expect(service.getByUserId(TENANT, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('updateMembership', () => {
    it('requires at least one field', async () => {
      await expect(
        service.updateMembership(adminActor, TENANT, MEMBERSHIP_ID, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('forbids actors from modifying their own membership', async () => {
      repo.byMembershipId = tenantUser({ userId: adminActor.id });
      await expect(
        service.updateMembership(adminActor, TENANT, MEMBERSHIP_ID, { role: 'auditor' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.lastUpdate).toBeNull();
    });

    it('rejects escalation to platform_owner', async () => {
      repo.byMembershipId = tenantUser();
      await expect(
        service.updateMembership(adminActor, TENANT, MEMBERSHIP_ID, {
          role: 'platform_owner' as never,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates role and status for another member', async () => {
      repo.byMembershipId = tenantUser();
      repo.updateResult = tenantUser({ role: 'auditor', membershipStatus: 'disabled' });

      const updated = await service.updateMembership(adminActor, TENANT, MEMBERSHIP_ID, {
        role: 'auditor',
        status: 'disabled',
      });
      expect(updated.role).toBe('auditor');
      expect(updated.membershipStatus).toBe('disabled');
      expect(repo.lastUpdate).toEqual([
        TENANT,
        MEMBERSHIP_ID,
        { role: 'auditor', status: 'disabled' },
      ]);
    });

    it('404s on unknown memberships', async () => {
      repo.byMembershipId = null;
      await expect(
        service.updateMembership(adminActor, TENANT, MEMBERSHIP_ID, { status: 'disabled' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
