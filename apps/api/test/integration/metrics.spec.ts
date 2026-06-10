import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

import type { Database } from '../../src/database/database.schema';
import { TenantScopedDb } from '../../src/database/tenant-scope';
import { MetricsService } from '../../src/modules/metrics/application/metrics.service';
import { KyselyMetricsRepository } from '../../src/modules/metrics/infrastructure/kysely-metrics.repository';

/**
 * Phase 13 integration (ADR-023): aggregates against real PostgreSQL with
 * seeded fixtures, inside the tenant scope. Same harness contract as the
 * other integration suites.
 */
const ADMIN_URL = process.env.DATABASE_URL;
const describeIntegration = ADMIN_URL ? describe : describe.skip;

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const RUNNER = path.join(REPO_ROOT, 'tools', 'db', 'migrate.mjs');

const APP_ROLE = 'aurion_app_test';
const APP_PASSWORD = 'aurion_app_test_password';

const TENANT_E = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TENANT_F = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const APPROVER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function appUrl(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}

describeIntegration('metrics aggregates against PostgreSQL', () => {
  jest.setTimeout(60_000);

  let admin: Kysely<Database>;
  let app: Kysely<Database>;
  let service: MetricsService;

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

    // Isolated fixtures (ids/slugs disjoint from the other suites).
    await admin
      .deleteFrom('tenants')
      .where((eb) =>
        eb.or([
          eb('id', 'in', [TENANT_E, TENANT_F]),
          eb('slug', 'in', ['metrics-p13', 'metrics-p13-other']),
        ]),
      )
      .execute();
    await admin.deleteFrom('users').where('id', '=', APPROVER).execute();
    await admin
      .insertInto('tenants')
      .values([
        { id: TENANT_E, slug: 'metrics-p13', name: 'Metrics E', settings: '{}' },
        { id: TENANT_F, slug: 'metrics-p13-other', name: 'Metrics F', settings: '{}' },
      ])
      .execute();
    await admin
      .insertInto('users')
      .values({ id: APPROVER, email: 'metrics@p13.test', display_name: 'Approver' })
      .execute();
    await admin
      .insertInto('tenant_memberships')
      .values({ tenant_id: TENANT_E, user_id: APPROVER, role: 'supervisor' })
      .execute();

    // Sessions: 2 completed, 1 failed, 1 active.
    await admin
      .insertInto('voice_sessions')
      .values(
        (['completed', 'completed', 'failed', 'active'] as const).map((status, index) => ({
          tenant_id: TENANT_E,
          external_session_id: `m13-${index}`,
          status,
        })),
      )
      .execute();

    // Actions: 1 executed (approved-ever), 1 rejected, 2 requested; one in
    // the OTHER tenant that must never leak in.
    await admin
      .insertInto('controlled_actions')
      .values([
        {
          tenant_id: TENANT_E,
          action_type: 'ticket.create',
          status: 'executed',
          actor_type: 'voice_agent',
          idempotency_key: 'm13-a',
          request_payload: '{}',
          approval_required: true,
          approved_by_user_id: APPROVER,
          correlation_id: 'm13',
        },
        {
          tenant_id: TENANT_E,
          action_type: 'ticket.create',
          status: 'rejected',
          actor_type: 'voice_agent',
          idempotency_key: 'm13-b',
          request_payload: '{}',
          approval_required: true,
          correlation_id: 'm13',
        },
        {
          tenant_id: TENANT_E,
          action_type: 'calendar.update',
          status: 'requested',
          actor_type: 'voice_agent',
          idempotency_key: 'm13-c',
          request_payload: '{}',
          approval_required: true,
          correlation_id: 'm13',
        },
        {
          tenant_id: TENANT_E,
          action_type: 'ticket.create',
          status: 'requested',
          actor_type: 'voice_agent',
          idempotency_key: 'm13-d',
          request_payload: '{}',
          approval_required: true,
          correlation_id: 'm13',
        },
        {
          tenant_id: TENANT_F,
          action_type: 'ticket.create',
          status: 'executed',
          actor_type: 'system',
          idempotency_key: 'm13-other',
          request_payload: '{}',
          correlation_id: 'm13',
        },
      ])
      .execute();

    app = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: appUrl(ADMIN_URL as string), max: 4 }),
      }),
    });
    service = new MetricsService(new KyselyMetricsRepository(new TenantScopedDb(app)));
  });

  afterAll(async () => {
    await app?.destroy();
    await admin?.destroy();
  });

  it('aggregates the tenant evidence with the documented rate definitions', async () => {
    const overview = await service.overview(TENANT_E, 7);

    expect(overview.sessions.total).toBe(4);
    expect(overview.sessions.byStatus).toEqual({ completed: 2, failed: 1, active: 1 });
    expect(overview.sessions.completionRate).toBeCloseTo(2 / 3);

    expect(overview.actions.total).toBe(4); // tenant F's action never leaks in
    expect(overview.actions.byStatus).toEqual({ executed: 1, rejected: 1, requested: 2 });
    expect(overview.actions.byType).toEqual({ 'ticket.create': 3, 'calendar.update': 1 });
    // Approved-ever (1, now executed) over decided (1 + 1 rejected).
    expect(overview.actions.approvalRate).toBeCloseTo(0.5);
    expect(overview.actions.executionSuccessRate).toBe(1);
    expect(overview.approvalsPending).toBe(2);
  });

  it('respects the time window', async () => {
    // Age one requested action out of a 1-day window.
    await admin
      .updateTable('controlled_actions')
      .set({ created_at: sql`now() - interval '3 days'` })
      .where('idempotency_key', '=', 'm13-d')
      .execute();

    const overview = await service.overview(TENANT_E, 1);
    expect(overview.actions.total).toBe(3);
    // The pending counter is live workload — window-independent.
    expect(overview.approvalsPending).toBe(2);
  });
});
