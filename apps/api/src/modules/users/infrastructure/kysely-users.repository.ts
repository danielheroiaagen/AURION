import { Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';

import { mapPgError } from '../../../common/errors/pg-error';
import { decodeCursor, toPage, type Page } from '../../../common/pagination/cursor';
import type { Database, MembershipRole, UserStatus } from '../../../database/database.schema';
import { TenantScopedDb } from '../../../database/tenant-scope';
import type {
  InviteUserInput,
  ListTenantUsersInput,
  TenantUser,
  UpdateMembershipFields,
  UsersRepositoryPort,
} from '../application/users.repository.port';

interface TenantUserRow {
  membership_id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  display_name: string;
  user_status: UserStatus;
  role: MembershipRole;
  membership_status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

function toTenantUser(row: TenantUserRow): TenantUser {
  return {
    id: row.membership_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    userStatus: row.user_status,
    role: row.role,
    membershipStatus: row.membership_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Kysely adapter for the users port.
 *
 * `users` is global and has NO RLS; `tenant_memberships` has RLS. Every read
 * here therefore starts from the membership table inside the tenant scope and
 * joins to `users` — a user with no membership in the active tenant is
 * unreachable by construction, which is the isolation contract.
 */
@Injectable()
export class KyselyUsersRepository implements UsersRepositoryPort {
  constructor(private readonly db: TenantScopedDb) {}

  async invite(input: InviteUserInput): Promise<TenantUser> {
    try {
      return await this.db.withTenant(input.tenantId, async (trx) => {
        // Reuse the global identity when the email exists; the invite never
        // mutates it (display name belongs to the user, not the inviter).
        const existing = await trx
          .selectFrom('users')
          .selectAll()
          .where(sql<string>`lower(email)`, '=', input.email.toLowerCase())
          .executeTakeFirst();

        const user =
          existing ??
          (await trx
            .insertInto('users')
            .values({
              email: input.email,
              display_name: input.displayName,
              status: 'invited',
            })
            .returningAll()
            .executeTakeFirstOrThrow());

        const membership = await trx
          .insertInto('tenant_memberships')
          .values({
            tenant_id: input.tenantId,
            user_id: user.id,
            role: input.role,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return toTenantUser({
          membership_id: membership.id,
          tenant_id: membership.tenant_id,
          user_id: user.id,
          email: user.email,
          display_name: user.display_name,
          user_status: user.status,
          role: membership.role,
          membership_status: membership.status,
          created_at: membership.created_at,
          updated_at: membership.updated_at,
        });
      });
    } catch (error) {
      mapPgError(error, {
        conflict: 'User is already a member of this tenant.',
        reference: 'Tenant does not exist.',
      });
    }
  }

  async findByUserId(tenantId: string, userId: string): Promise<TenantUser | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      this.baseSelect(trx).where('m.user_id', '=', userId).executeTakeFirst(),
    );
    return row ? toTenantUser(row) : null;
  }

  async findByMembershipId(tenantId: string, membershipId: string): Promise<TenantUser | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      this.baseSelect(trx).where('m.id', '=', membershipId).executeTakeFirst(),
    );
    return row ? toTenantUser(row) : null;
  }

  async list(input: ListTenantUsersInput): Promise<Page<TenantUser>> {
    const rows = await this.db.withTenant(input.tenantId, (trx) => {
      let query = this.baseSelect(trx)
        .orderBy('m.created_at', 'desc')
        .orderBy('m.id', 'desc')
        .limit(input.limit + 1);

      if (input.role) {
        query = query.where('m.role', '=', input.role);
      }
      if (input.membershipStatus) {
        query = query.where('m.status', '=', input.membershipStatus);
      }
      if (input.cursor) {
        const position = decodeCursor(input.cursor);
        query = query.where(
          sql<boolean>`(m.created_at, m.id) < (${position.createdAt}::timestamptz, ${position.id}::uuid)`,
        );
      }
      return query.execute();
    });

    return toPage(rows.map(toTenantUser), input.limit);
  }

  async updateMembership(
    tenantId: string,
    membershipId: string,
    fields: UpdateMembershipFields,
  ): Promise<TenantUser | null> {
    const row = await this.db.withTenant(tenantId, async (trx) => {
      const updated = await trx
        .updateTable('tenant_memberships')
        .set({
          ...(fields.role !== undefined ? { role: fields.role } : {}),
          ...(fields.status !== undefined ? { status: fields.status } : {}),
          updated_at: sql`now()`,
        })
        .where('id', '=', membershipId)
        .returning('id')
        .executeTakeFirst();
      if (!updated) {
        return undefined;
      }
      return this.baseSelect(trx).where('m.id', '=', membershipId).executeTakeFirst();
    });
    return row ? toTenantUser(row) : null;
  }

  private baseSelect(trx: Transaction<Database>) {
    return trx
      .selectFrom('tenant_memberships as m')
      .innerJoin('users as u', 'u.id', 'm.user_id')
      .select([
        'm.id as membership_id',
        'm.tenant_id as tenant_id',
        'm.user_id as user_id',
        'u.email as email',
        'u.display_name as display_name',
        'u.status as user_status',
        'm.role as role',
        'm.status as membership_status',
        'm.created_at as created_at',
        'm.updated_at as updated_at',
      ]);
  }
}
