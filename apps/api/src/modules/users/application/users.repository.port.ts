import type { Page } from '../../../common/pagination/cursor';
import type { MembershipRole, UserStatus } from '../../../database/database.schema';

/**
 * A user as seen from inside one tenant: the global identity row joined to
 * its membership. `users` is a global table without RLS, so the membership
 * join (RLS-protected) is the ONLY path the application may reach it through
 * — exposing users without a membership filter would leak identities across
 * tenants.
 *
 * `id`/`createdAt` are the MEMBERSHIP's id and creation time: they drive the
 * cursor pagination total order and the `/memberships/:id` route.
 */
export interface TenantUser {
  /** Membership id (pagination + PATCH route identity). */
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly userStatus: UserStatus;
  readonly role: MembershipRole;
  readonly membershipStatus: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface InviteUserInput {
  readonly tenantId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: MembershipRole;
}

export interface ListTenantUsersInput {
  readonly tenantId: string;
  readonly role?: MembershipRole;
  readonly membershipStatus?: UserStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface UpdateMembershipFields {
  readonly role?: MembershipRole;
  readonly status?: UserStatus;
}

export interface UsersRepositoryPort {
  /**
   * Invite a user into a tenant: reuse the global identity when the email
   * already exists (never mutating it), create it as `invited` otherwise, and
   * add the membership — all in one tenant-scoped transaction.
   */
  invite(input: InviteUserInput): Promise<TenantUser>;
  findByUserId(tenantId: string, userId: string): Promise<TenantUser | null>;
  findByMembershipId(tenantId: string, membershipId: string): Promise<TenantUser | null>;
  list(input: ListTenantUsersInput): Promise<Page<TenantUser>>;
  /** Returns null when the membership does not exist in this tenant. */
  updateMembership(
    tenantId: string,
    membershipId: string,
    fields: UpdateMembershipFields,
  ): Promise<TenantUser | null>;
}

/** DI token for the users repository port. */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
