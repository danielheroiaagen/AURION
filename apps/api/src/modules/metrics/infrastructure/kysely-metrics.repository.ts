import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';

import { TenantScopedDb } from '../../../database/tenant-scope';
import type {
  MetricsRepositoryPort,
  RawMetricCounts,
} from '../application/metrics.repository.port';

function toRecord(rows: Array<{ key: string; count: string | number | bigint }>): Record<string, number> {
  const record: Record<string, number> = {};
  for (const row of rows) {
    record[row.key] = Number(row.count);
  }
  return record;
}

/**
 * SQL aggregates inside the tenant scope (ADR-023): RLS guarantees these
 * GROUP BYs can never see another tenant's rows. Per-request aggregation is
 * fine at MVP volume; materialized rollups would land behind this same port.
 */
@Injectable()
export class KyselyMetricsRepository implements MetricsRepositoryPort {
  constructor(private readonly db: TenantScopedDb) {}

  async collect(tenantId: string, windowDays: number): Promise<RawMetricCounts> {
    return this.db.withTenant(tenantId, async (trx) => {
      const windowStart = sql<Date>`now() - make_interval(days => ${windowDays})`;

      const sessionRows = await trx
        .selectFrom('voice_sessions')
        .select(['status as key', (eb) => eb.fn.countAll().as('count')])
        .where('created_at', '>=', windowStart)
        .groupBy('status')
        .execute();

      const actionStatusRows = await trx
        .selectFrom('controlled_actions')
        .select(['status as key', (eb) => eb.fn.countAll().as('count')])
        .where('created_at', '>=', windowStart)
        .groupBy('status')
        .execute();

      const actionTypeRows = await trx
        .selectFrom('controlled_actions')
        .select(['action_type as key', (eb) => eb.fn.countAll().as('count')])
        .where('created_at', '>=', windowStart)
        .groupBy('action_type')
        .execute();

      const approvedEver = await trx
        .selectFrom('controlled_actions')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('created_at', '>=', windowStart)
        .where('approved_by_user_id', 'is not', null)
        .executeTakeFirstOrThrow();

      const pending = await trx
        .selectFrom('controlled_actions')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('status', '=', 'requested')
        .executeTakeFirstOrThrow();

      return {
        sessionsByStatus: toRecord(sessionRows as never),
        actionsByStatus: toRecord(actionStatusRows as never),
        actionsByType: toRecord(actionTypeRows as never),
        actionsApprovedEver: Number(approvedEver.count),
        approvalsPending: Number(pending.count),
      };
    });
  }
}
