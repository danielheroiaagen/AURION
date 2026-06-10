import { DbAuditSink } from '../../src/modules/auth/infrastructure/db-audit.sink';
import { LoggingAuditSink } from '../../src/modules/auth/infrastructure/logging-audit.sink';
import type { AuthorizationAuditEvidence } from '../../src/modules/auth/domain/authorization';
import type { TenantScopedDb } from '../../src/database/tenant-scope';

const TENANT = '11111111-1111-4111-8111-111111111111';

const evidence: AuthorizationAuditEvidence = {
  actorId: 'user-1',
  actorType: 'user',
  tenantId: TENANT,
  permission: 'knowledge:write',
  outcome: 'allowed',
  correlationId: 'corr-1',
};

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('DbAuditSink', () => {
  let inserted: Record<string, unknown>[];
  let scopedTenants: string[];
  let failInsert: boolean;
  let fallbackRecorded: AuthorizationAuditEvidence[];

  const fakeDb = {
    withTenant: async (tenantId: string, fn: (trx: unknown) => Promise<unknown>) => {
      scopedTenants.push(tenantId);
      if (failInsert) {
        throw new Error('database unavailable');
      }
      const trx = {
        insertInto: () => trx,
        values: (row: Record<string, unknown>) => {
          inserted.push(row);
          return trx;
        },
        execute: async () => [],
      };
      return fn(trx);
    },
  } as unknown as TenantScopedDb;

  let sink: DbAuditSink;

  beforeEach(() => {
    inserted = [];
    scopedTenants = [];
    failInsert = false;
    fallbackRecorded = [];
    const fallback = new LoggingAuditSink();
    jest
      .spyOn(fallback, 'record')
      .mockImplementation((e: AuthorizationAuditEvidence) => void fallbackRecorded.push(e));
    sink = new DbAuditSink(fakeDb, fallback);
  });

  it('persists evidence inside the evidence tenant scope', async () => {
    sink.record(evidence);
    await flushAsync();

    expect(scopedTenants).toEqual([TENANT]);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      tenant_id: TENANT,
      actor_type: 'user',
      actor_user_id: 'user-1',
      action: 'knowledge:write',
      outcome: 'allowed',
      correlation_id: 'corr-1',
    });
    expect(fallbackRecorded).toHaveLength(0);
  });

  it('never links machine actors to a user row', async () => {
    sink.record({ ...evidence, actorType: 'voice_agent', actorId: 'agent-1' });
    await flushAsync();
    expect(inserted[0].actor_user_id).toBeNull();
  });

  it('falls back to logging when there is no tenant context', async () => {
    sink.record({ ...evidence, tenantId: null });
    await flushAsync();
    expect(inserted).toHaveLength(0);
    expect(fallbackRecorded).toHaveLength(1);
  });

  it('falls back to logging when the database write fails — evidence is never dropped', async () => {
    failInsert = true;
    sink.record(evidence);
    await flushAsync();
    expect(fallbackRecorded).toHaveLength(1);
  });
});
