import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

import { BadGatewayException, ConflictException } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

import { FieldEncryptionService } from '../../src/common/crypto/field-encryption.service';
import type { Database } from '../../src/database/database.schema';
import { TenantScopedDb } from '../../src/database/tenant-scope';
import { PolicyService } from '../../src/modules/auth/application/policy.service';
import type { AuthenticatedActor } from '../../src/modules/auth/domain/actor';
import { ControlledActionsService } from '../../src/modules/actions/application/controlled-actions.service';
import { KyselyControlledActionsRepository } from '../../src/modules/actions/infrastructure/kysely-controlled-actions.repository';
import { UsersService } from '../../src/modules/users/application/users.service';
import { KyselyUsersRepository } from '../../src/modules/users/infrastructure/kysely-users.repository';

/**
 * Phase 5 integration suite (ADR-014 + users administration) against real
 * PostgreSQL. Same harness contract as the other integration suites: a
 * privileged DATABASE_URL plus the NOBYPASSRLS application role.
 */
const ADMIN_URL = process.env.DATABASE_URL;
const describeIntegration = ADMIN_URL ? describe : describe.skip;

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const RUNNER = path.join(REPO_ROOT, 'tools', 'db', 'migrate.mjs');

const APP_ROLE = 'aurion_app_test';
const APP_PASSWORD = 'aurion_app_test_password';

const TENANT_C = '88888888-8888-4888-8888-888888888888';
const TENANT_D = '99999999-9999-4999-8999-999999999999';
const ADMIN_C = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_D = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const INVITED_EMAILS = ['pat@globex.test', 'shared@globex.test'];

const adminActorC: AuthenticatedActor = {
  id: ADMIN_C,
  tenantId: TENANT_C,
  type: 'user',
  role: 'tenant_admin',
};

function appUrl(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}

describeIntegration('users administration & action dispatch against PostgreSQL', () => {
  jest.setTimeout(60_000);

  let admin: Kysely<Database>;
  let app: Kysely<Database>;
  let scoped: TenantScopedDb;
  let users: UsersService;
  let usersD: UsersService;

  beforeAll(async () => {
    execFileSync(process.execPath, [RUNNER, 'migrate'], {
      env: { ...process.env, DATABASE_URL: ADMIN_URL },
      encoding: 'utf8',
    });

    admin = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: ADMIN_URL, max: 2 }) }),
    });

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${sql.lit(APP_ROLE)}) THEN
          CREATE ROLE ${sql.raw(APP_ROLE)} LOGIN PASSWORD ${sql.lit(APP_PASSWORD)} NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
    `.execute(admin);
    await sql`GRANT USAGE ON SCHEMA public TO ${sql.raw(APP_ROLE)}`.execute(admin);
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${sql.raw(APP_ROLE)}`.execute(
      admin,
    );

    // Isolated fixtures (ids/emails disjoint from the other suites).
    await admin.deleteFrom('tenants').where('id', 'in', [TENANT_C, TENANT_D]).execute();
    await admin.deleteFrom('users').where('id', 'in', [ADMIN_C, ADMIN_D]).execute();
    await admin
      .deleteFrom('users')
      .where(sql<string>`lower(email)`, 'in', INVITED_EMAILS)
      .execute();
    await admin
      .insertInto('tenants')
      .values([
        { id: TENANT_C, slug: 'globex', name: 'Globex', settings: '{}' },
        { id: TENANT_D, slug: 'hooli', name: 'Hooli', settings: '{}' },
      ])
      .execute();
    await admin
      .insertInto('users')
      .values([
        { id: ADMIN_C, email: 'cady@globex.test', display_name: 'Cady' },
        { id: ADMIN_D, email: 'dan@hooli.test', display_name: 'Dan' },
      ])
      .execute();
    await admin
      .insertInto('tenant_memberships')
      .values([
        { tenant_id: TENANT_C, user_id: ADMIN_C, role: 'tenant_admin' },
        { tenant_id: TENANT_D, user_id: ADMIN_D, role: 'tenant_admin' },
      ])
      .execute();

    app = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: appUrl(ADMIN_URL as string), max: 4 }),
      }),
    });
    scoped = new TenantScopedDb(app);
    users = new UsersService(new KyselyUsersRepository(scoped));
    usersD = users; // same service; tenant comes from the call site
  });

  afterAll(async () => {
    await app?.destroy();
    await admin?.destroy();
  });

  it('invite → list → role change → disable, all through the membership join', async () => {
    const invited = await users.invite(TENANT_C, {
      email: 'pat@globex.test',
      displayName: 'Pat',
      role: 'supervisor',
    });
    expect(invited.userStatus).toBe('invited');
    expect(invited.membershipStatus).toBe('active');

    const page = await users.list({ tenantId: TENANT_C, limit: 10 });
    expect(page.items.map((item) => item.email)).toEqual(
      expect.arrayContaining(['pat@globex.test', 'cady@globex.test']),
    );

    const demoted = await users.updateMembership(adminActorC, TENANT_C, invited.id, {
      role: 'auditor',
      status: 'disabled',
    });
    expect(demoted.role).toBe('auditor');
    expect(demoted.membershipStatus).toBe('disabled');
  });

  it('re-inviting the same email into the same tenant conflicts; into another tenant reuses the identity', async () => {
    const first = await users.invite(TENANT_C, {
      email: 'shared@globex.test',
      displayName: 'Shared',
      role: 'human_agent',
    });

    await expect(
      users.invite(TENANT_C, {
        email: 'shared@globex.test',
        displayName: 'Shared again',
        role: 'auditor',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Same email in tenant D: one global identity, two memberships.
    const inOtherTenant = await usersD.invite(TENANT_D, {
      email: 'shared@globex.test',
      displayName: 'Ignored — identity exists',
      role: 'auditor',
    });
    expect(inOtherTenant.userId).toBe(first.userId);
    expect(inOtherTenant.displayName).toBe('Shared'); // invite never mutates identity
  });

  it('memberships are invisible across tenants (RLS through the join)', async () => {
    const fromD = await users.list({ tenantId: TENANT_D, limit: 50 });
    expect(fromD.items.map((item) => item.email)).not.toContain('pat@globex.test');

    const direct = await users.getByUserId(TENANT_D, ADMIN_C).catch((error) => error);
    expect(direct).toBeInstanceOf(Error); // NotFound: no membership in D
  });

  it('failed dispatch persists failed status with encrypted error evidence (ADR-014)', async () => {
    const crypto = new FieldEncryptionService([{ id: 'itest5', key: randomBytes(32) }]);
    const actions = new ControlledActionsService(
      new KyselyControlledActionsRepository(scoped, crypto),
      {
        dispatch: async () => ({
          ok: false,
          errorCode: 'dispatch_unreachable',
          message: 'HERMES endpoint could not be reached.',
        }),
      },
      new PolicyService({ record: () => undefined }),
    );

    const { action } = await actions.request(adminActorC, TENANT_C, {
      actionType: 'ticket.create',
      voiceSessionId: null,
      requestPayload: { subject: 'will fail to dispatch' },
      idempotencyKey: 'phase5-fail-1',
      correlationId: 'itest5-fail-1',
    });

    await expect(
      actions.execute(adminActorC, TENANT_C, action.id, 'itest5-fail-1'),
    ).rejects.toBeInstanceOf(BadGatewayException);

    const failed = await actions.getById(TENANT_C, action.id);
    expect(failed.status).toBe('failed');
    expect(failed.resultPayload).toEqual({
      error: { code: 'dispatch_unreachable', message: 'HERMES endpoint could not be reached.' },
    });

    // Raw evidence is ciphertext, not the error text.
    const raw = await admin
      .selectFrom('controlled_actions')
      .select('result_payload')
      .where('id', '=', action.id)
      .executeTakeFirstOrThrow();
    expect((raw.result_payload as { ciphertext?: string }).ciphertext).toMatch(/^enc:v1:itest5:/);
    expect(JSON.stringify(raw.result_payload)).not.toContain('unreachable');
  });
});
