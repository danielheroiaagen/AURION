import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

import type { Database } from '../../src/database/database.schema';
import { TenantScopedDb } from '../../src/database/tenant-scope';
import { DbAuditSink } from '../../src/modules/auth/infrastructure/db-audit.sink';
import { LoggingAuditSink } from '../../src/modules/auth/infrastructure/logging-audit.sink';
import { KyselyKnowledgeDocumentsRepository } from '../../src/modules/knowledge/infrastructure/kysely-knowledge-documents.repository';
import { KyselyTenantsRepository } from '../../src/modules/tenants/infrastructure/kysely-tenants.repository';

/**
 * Persistence integration suite (ADR-012).
 *
 * Runs only when DATABASE_URL points at a PostgreSQL instance (mandatory in
 * CI, optional locally). DATABASE_URL must be a privileged/admin connection:
 * it applies the real migrations through the real runner, then creates a
 * dedicated NON-superuser role for the application pool — superusers bypass
 * RLS, so testing isolation through an admin connection would prove nothing.
 */
const ADMIN_URL = process.env.DATABASE_URL;
const describeIntegration = ADMIN_URL ? describe : describe.skip;

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const RUNNER = path.join(REPO_ROOT, 'tools', 'db', 'migrate.mjs');

const APP_ROLE = 'aurion_app_test';
const APP_PASSWORD = 'aurion_app_test_password';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_A = '33333333-3333-4333-8333-333333333333';

function runMigrations(command: 'migrate' | 'status'): string {
  return execFileSync(process.execPath, [RUNNER, command], {
    env: { ...process.env, DATABASE_URL: ADMIN_URL },
    encoding: 'utf8',
  });
}

function appUrl(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}

async function eventually<T>(probe: () => Promise<T | undefined>, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await probe();
    if (result !== undefined) {
      return result;
    }
    if (Date.now() > deadline) {
      throw new Error('Condition not met in time.');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describeIntegration('persistence layer against PostgreSQL', () => {
  jest.setTimeout(60_000);

  let admin: Kysely<Database>;
  let app: Kysely<Database>;
  let scoped: TenantScopedDb;

  beforeAll(async () => {
    // 1. Real migrations through the real runner (idempotent).
    runMigrations('migrate');

    admin = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: ADMIN_URL, max: 2 }) }),
    });

    // 2. Non-superuser application role: RLS applies to it.
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

    // 3. Clean slate + seed two tenants and one member of tenant A.
    await sql`TRUNCATE tenants, users CASCADE`.execute(admin);
    await admin
      .insertInto('tenants')
      .values([
        { id: TENANT_A, slug: 'acme', name: 'ACME', settings: '{}' },
        { id: TENANT_B, slug: 'globex', name: 'Globex', settings: '{}' },
      ])
      .execute();
    await admin
      .insertInto('users')
      .values({ id: USER_A, email: 'ana@acme.test', display_name: 'Ana' })
      .execute();
    await admin
      .insertInto('tenant_memberships')
      .values({ tenant_id: TENANT_A, user_id: USER_A, role: 'tenant_admin' })
      .execute();

    app = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: appUrl(ADMIN_URL as string), max: 4 }),
      }),
    });
    scoped = new TenantScopedDb(app);
  });

  afterAll(async () => {
    await app?.destroy();
    await admin?.destroy();
  });

  it('migration runner is idempotent and reports a clean status', () => {
    expect(runMigrations('migrate')).toContain('up to date');
    const status = runMigrations('status');
    expect(status).toContain('Pending: 0');
  });

  it('blocks tenant-owned tables without a tenant context (safe default: no rows)', async () => {
    const rows = await app.selectFrom('tenants').selectAll().execute();
    expect(rows).toHaveLength(0);
  });

  it('isolates tenants through RLS: a scope only sees its own tenant row', async () => {
    const visible = await scoped.withTenant(TENANT_A, (trx) =>
      trx.selectFrom('tenants').select('id').execute(),
    );
    expect(visible.map((r) => r.id)).toEqual([TENANT_A]);
  });

  it('tenants repository reads and updates settings inside the tenant scope', async () => {
    const repo = new KyselyTenantsRepository(scoped);

    const tenant = await repo.findById(TENANT_A);
    expect(tenant?.slug).toBe('acme');

    const updated = await repo.updateSettings(TENANT_A, { language: 'es-ES' });
    expect(updated?.settings).toEqual({ language: 'es-ES' });

    // A foreign tenant is invisible from another scope — RLS, not app logic.
    const fromWrongScope = await scoped.withTenant(TENANT_B, (trx) =>
      trx.selectFrom('tenants').selectAll().where('id', '=', TENANT_A).executeTakeFirst(),
    );
    expect(fromWrongScope).toBeUndefined();
  });

  it('knowledge documents are invisible and unwritable across tenants', async () => {
    const repo = new KyselyKnowledgeDocumentsRepository(scoped);

    const created = await repo.create({
      tenantId: TENANT_A,
      title: 'Pricing FAQ',
      sourceUri: null,
      contentSha256: 'a'.repeat(64),
      createdByUserId: USER_A,
    });
    expect(created.status).toBe('draft');

    // Reads from tenant B see nothing.
    expect(await repo.findById(TENANT_B, created.id)).toBeNull();
    const pageB = await repo.list({ tenantId: TENANT_B, limit: 10 });
    expect(pageB.items).toHaveLength(0);

    // Writes for tenant A from tenant B's scope violate the RLS WITH CHECK.
    await expect(
      scoped.withTenant(TENANT_B, (trx) =>
        trx
          .insertInto('knowledge_documents')
          .values({
            tenant_id: TENANT_A,
            title: 'forged',
            source_uri: null,
            content_sha256: 'b'.repeat(64),
            created_by_user_id: null,
          })
          .execute(),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it('enforces the lifecycle compare-and-set at the database layer', async () => {
    const repo = new KyselyKnowledgeDocumentsRepository(scoped);
    const doc = await repo.create({
      tenantId: TENANT_A,
      title: 'Lifecycle doc',
      sourceUri: null,
      contentSha256: 'c'.repeat(64),
      createdByUserId: null,
    });

    const reviewed = await repo.transitionStatus(TENANT_A, doc.id, 'draft', 'review');
    expect(reviewed?.status).toBe('review');

    // Stale expectation matches no row.
    expect(await repo.transitionStatus(TENANT_A, doc.id, 'draft', 'review')).toBeNull();

    const published = await repo.transitionStatus(TENANT_A, doc.id, 'review', 'published');
    expect(published?.publishedAt).toBeInstanceOf(Date);
  });

  it('maps database integrity violations to stable HTTP errors', async () => {
    const repo = new KyselyKnowledgeDocumentsRepository(scoped);
    const input = {
      tenantId: TENANT_A,
      title: 'Duplicate content',
      sourceUri: null,
      contentSha256: 'd'.repeat(64),
      createdByUserId: null,
    };
    await repo.create(input);
    await expect(repo.create(input)).rejects.toBeInstanceOf(ConflictException);

    await expect(
      repo.create({
        ...input,
        contentSha256: 'e'.repeat(64),
        createdByUserId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('paginates with opaque cursors over a stable total order', async () => {
    const repo = new KyselyKnowledgeDocumentsRepository(scoped);
    for (let i = 0; i < 5; i += 1) {
      await repo.create({
        tenantId: TENANT_A,
        title: `Paged ${i}`,
        sourceUri: null,
        contentSha256: `${i}`.repeat(64).slice(0, 63) + 'f',
        createdByUserId: null,
      });
    }

    const seen = new Set<string>();
    let cursor: string | undefined;
    for (;;) {
      const page = await repo.list({ tenantId: TENANT_A, limit: 2, cursor });
      page.items.forEach((doc) => seen.add(doc.id));
      if (!page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
    }
    // All documents created across the suite for tenant A, no duplicates.
    const total = await scoped.withTenant(TENANT_A, (trx) =>
      trx.selectFrom('knowledge_documents').select('id').execute(),
    );
    expect(seen.size).toBe(total.length);
  });

  it('persists authorization evidence and the table stays append-only', async () => {
    const sink = new DbAuditSink(scoped, new LoggingAuditSink());
    sink.record({
      actorId: USER_A,
      actorType: 'user',
      tenantId: TENANT_A,
      permission: 'knowledge:write',
      outcome: 'allowed',
      correlationId: 'itest-corr-1',
    });

    const event = await eventually(async () => {
      const row = await scoped.withTenant(TENANT_A, (trx) =>
        trx
          .selectFrom('audit_events')
          .selectAll()
          .where('correlation_id', '=', 'itest-corr-1')
          .executeTakeFirst(),
      );
      return row ?? undefined;
    });
    expect(event.action).toBe('knowledge:write');
    expect(event.outcome).toBe('allowed');

    // Append-only trigger blocks mutation — even for the admin connection.
    for (const db of [scoped, undefined] as const) {
      const attempt = db
        ? db.withTenant(TENANT_A, (trx) =>
            trx
              .updateTable('audit_events')
              .set({ action: 'tampered' })
              .where('id', '=', event.id)
              .execute(),
          )
        : admin
            .updateTable('audit_events')
            .set({ action: 'tampered' })
            .where('id', '=', event.id)
            .execute();
      await expect(attempt).rejects.toThrow(/append-only/);
    }
    await expect(
      admin.deleteFrom('audit_events').where('id', '=', event.id).execute(),
    ).rejects.toThrow(/append-only/);
  });

  it('cross-tenant audit reads see nothing', async () => {
    const rows = await scoped.withTenant(TENANT_B, (trx) =>
      trx.selectFrom('audit_events').selectAll().execute(),
    );
    expect(rows).toHaveLength(0);
  });
});
