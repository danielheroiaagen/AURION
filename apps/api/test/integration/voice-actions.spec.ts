import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

import {
  FieldEncryptionService,
} from '../../src/common/crypto/field-encryption.service';
import type { Database } from '../../src/database/database.schema';
import { TenantScopedDb } from '../../src/database/tenant-scope';
import { PolicyService } from '../../src/modules/auth/application/policy.service';
import type { AuthenticatedActor } from '../../src/modules/auth/domain/actor';
import { ControlledActionsService } from '../../src/modules/actions/application/controlled-actions.service';
import { KyselyControlledActionsRepository } from '../../src/modules/actions/infrastructure/kysely-controlled-actions.repository';
import { NoopDispatcher } from '../../src/modules/actions/infrastructure/noop.dispatcher';
import { VoiceSessionsService } from '../../src/modules/voice-sessions/application/voice-sessions.service';
import { KyselyVoiceSessionsRepository } from '../../src/modules/voice-sessions/infrastructure/kysely-voice-sessions.repository';

/**
 * Phase 4 integration suite (ADR-013): voice sessions and controlled actions
 * against real PostgreSQL. Same harness contract as `persistence.spec.ts` —
 * DATABASE_URL must be a privileged connection; the suite reuses the
 * NOBYPASSRLS application role created there (or creates it if this file runs
 * first).
 */
const ADMIN_URL = process.env.DATABASE_URL;
const describeIntegration = ADMIN_URL ? describe : describe.skip;

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const RUNNER = path.join(REPO_ROOT, 'tools', 'db', 'migrate.mjs');

const APP_ROLE = 'aurion_app_test';
const APP_PASSWORD = 'aurion_app_test_password';

const TENANT_A = '44444444-4444-4444-8444-444444444444';
const TENANT_B = '55555555-5555-4555-8555-555555555555';
const ADMIN_USER = '66666666-6666-4666-8666-666666666666';
const SUPERVISOR_USER = '77777777-7777-4777-8777-777777777777';

const adminActor: AuthenticatedActor = {
  id: ADMIN_USER,
  tenantId: TENANT_A,
  type: 'user',
  role: 'tenant_admin',
};

const supervisorActor: AuthenticatedActor = {
  id: SUPERVISOR_USER,
  tenantId: TENANT_A,
  type: 'user',
  role: 'supervisor',
};

const agentActor: AuthenticatedActor = {
  id: 'voice-agent-1',
  tenantId: TENANT_A,
  type: 'voice_agent',
  role: null,
};

function appUrl(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}

describeIntegration('voice sessions & controlled actions against PostgreSQL', () => {
  jest.setTimeout(60_000);

  let admin: Kysely<Database>;
  let app: Kysely<Database>;
  let scoped: TenantScopedDb;
  let crypto: FieldEncryptionService;
  let sessions: VoiceSessionsService;
  let actions: ControlledActionsService;

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

    // Isolated fixtures for this suite (ids disjoint from persistence.spec.ts).
    await admin.deleteFrom('tenants').where('id', 'in', [TENANT_A, TENANT_B]).execute();
    await admin.deleteFrom('users').where('id', 'in', [ADMIN_USER, SUPERVISOR_USER]).execute();
    await admin
      .insertInto('tenants')
      .values([
        { id: TENANT_A, slug: 'initech', name: 'Initech', settings: '{}' },
        { id: TENANT_B, slug: 'umbrella', name: 'Umbrella', settings: '{}' },
      ])
      .execute();
    await admin
      .insertInto('users')
      .values([
        { id: ADMIN_USER, email: 'bo@initech.test', display_name: 'Bo' },
        { id: SUPERVISOR_USER, email: 'sue@initech.test', display_name: 'Sue' },
      ])
      .execute();
    await admin
      .insertInto('tenant_memberships')
      .values([
        { tenant_id: TENANT_A, user_id: ADMIN_USER, role: 'tenant_admin' },
        { tenant_id: TENANT_A, user_id: SUPERVISOR_USER, role: 'supervisor' },
      ])
      .execute();

    app = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: appUrl(ADMIN_URL as string), max: 4 }),
      }),
    });
    scoped = new TenantScopedDb(app);
    crypto = new FieldEncryptionService([{ id: 'itest', key: randomBytes(32) }]);
    sessions = new VoiceSessionsService(new KyselyVoiceSessionsRepository(scoped, crypto));
    actions = new ControlledActionsService(
      new KyselyControlledActionsRepository(scoped, crypto),
      new NoopDispatcher(),
      new PolicyService({ record: () => undefined }),
    );
  });

  afterAll(async () => {
    await app?.destroy();
    await admin?.destroy();
  });

  it('voice session summary is ciphertext at rest and plaintext through the port', async () => {
    const { session } = await sessions.start(agentActor, TENANT_A, 'ext-call-1');
    await sessions.changeStatus(TENANT_A, session.id, 'active', {});
    const closed = await sessions.changeStatus(TENANT_A, session.id, 'completed', {
      summary: 'Customer asked for pricing; quoted plan B.',
      outcome: 'quote_sent',
    });

    expect(closed.summary).toBe('Customer asked for pricing; quoted plan B.');
    expect(closed.endedAt).toBeInstanceOf(Date);

    // Raw column read (admin bypasses RLS): must NOT contain the plaintext.
    const raw = await admin
      .selectFrom('voice_sessions')
      .select('summary')
      .where('id', '=', session.id)
      .executeTakeFirstOrThrow();
    expect(raw.summary).toMatch(/^enc:v1:itest:/);
    expect(raw.summary).not.toContain('pricing');
  });

  it('voice session start is idempotent on external_session_id', async () => {
    const first = await sessions.start(agentActor, TENANT_A, 'ext-call-2');
    const replay = await sessions.start(agentActor, TENANT_A, 'ext-call-2');
    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.session.id).toBe(first.session.id);
  });

  it('voice sessions are invisible across tenants (RLS)', async () => {
    const { session } = await sessions.start(agentActor, TENANT_A, 'ext-call-3');
    const fromB = await scoped.withTenant(TENANT_B, (trx) =>
      trx.selectFrom('voice_sessions').selectAll().where('id', '=', session.id).executeTakeFirst(),
    );
    expect(fromB).toBeUndefined();
  });

  it('lifecycle CAS rejects concurrent/illegal transitions at the database layer', async () => {
    const { session } = await sessions.start(agentActor, TENANT_A, 'ext-call-4');
    await sessions.changeStatus(TENANT_A, session.id, 'completed', {});
    await expect(
      sessions.changeStatus(TENANT_A, session.id, 'active', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('action request → human approval → agent execution, with payloads encrypted at rest', async () => {
    const { action: requested, created } = await actions.request(agentActor, TENANT_A, {
      actionType: 'ticket.create',
      voiceSessionId: null,
      requestPayload: { subject: 'Create follow-up ticket', priority: 'high' },
      idempotencyKey: 'flow-key-1',
      correlationId: 'itest-flow-1',
    });
    expect(created).toBe(true);
    expect(requested.approvalRequired).toBe(true);
    expect(requested.status).toBe('requested');

    // Voice agent cannot execute before approval.
    await expect(
      actions.execute(agentActor, TENANT_A, requested.id, 'itest-flow-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    // A human supervisor (not the requester) approves.
    const approved = await actions.approve(
      supervisorActor,
      TENANT_A,
      requested.id,
      'itest-flow-1',
    );
    expect(approved.status).toBe('approved');
    expect(approved.approvedByUserId).toBe(SUPERVISOR_USER);

    // Now the agent executes; the policy receives the recorded approval and
    // the result evidence comes from the dispatcher (ADR-014), not the client.
    const executed = await actions.execute(agentActor, TENANT_A, requested.id, 'itest-flow-1');
    expect(executed.status).toBe('executed');
    expect(executed.resultPayload).toMatchObject({
      dispatch_mode: 'noop',
      action_id: requested.id,
      action_type: 'ticket.create',
    });

    // Raw columns hold ciphertext envelopes, not business data.
    const raw = await admin
      .selectFrom('controlled_actions')
      .select(['request_payload', 'result_payload'])
      .where('id', '=', requested.id)
      .executeTakeFirstOrThrow();
    expect((raw.request_payload as { ciphertext?: string }).ciphertext).toMatch(/^enc:v1:itest:/);
    expect(JSON.stringify(raw.request_payload)).not.toContain('follow-up');
    expect((raw.result_payload as { ciphertext?: string }).ciphertext).toMatch(/^enc:v1:itest:/);
    expect(JSON.stringify(raw.result_payload)).not.toContain('dispatch_mode');
  });

  it('Idempotency-Key replay returns the original action; divergent replay conflicts', async () => {
    const input = {
      actionType: 'ticket.create' as const,
      voiceSessionId: null,
      requestPayload: { subject: 'replay me' },
      idempotencyKey: 'replay-key-1',
      correlationId: 'itest-replay-1',
    };
    const first = await actions.request(adminActor, TENANT_A, input);
    const replay = await actions.request(adminActor, TENANT_A, input);
    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.action.id).toBe(first.action.id);

    await expect(
      actions.request(adminActor, TENANT_A, {
        ...input,
        requestPayload: { subject: 'different payload' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('actions are invisible across tenants (RLS)', async () => {
    const { action } = await actions.request(adminActor, TENANT_A, {
      actionType: 'ticket.create',
      voiceSessionId: null,
      requestPayload: { subject: 'tenant A only' },
      idempotencyKey: 'rls-key-1',
      correlationId: 'itest-rls-1',
    });
    const fromB = await scoped.withTenant(TENANT_B, (trx) =>
      trx
        .selectFrom('controlled_actions')
        .selectAll()
        .where('id', '=', action.id)
        .executeTakeFirst(),
    );
    expect(fromB).toBeUndefined();
  });
});
