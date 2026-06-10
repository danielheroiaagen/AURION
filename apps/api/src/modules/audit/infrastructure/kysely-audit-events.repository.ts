import { Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';

import { decodeCursor, toPage, type Page } from '../../../common/pagination/cursor';
import type { AuditEventsTable } from '../../../database/database.schema';
import { TenantScopedDb } from '../../../database/tenant-scope';
import type {
  AuditEvent,
  AuditEventsRepositoryPort,
  ListAuditEventsInput,
} from '../application/audit-events.repository.port';

function toAuditEvent(row: Selectable<AuditEventsTable>): AuditEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorType: row.actor_type,
    actorUserId: row.actor_user_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    outcome: row.outcome,
    correlationId: row.correlation_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

/** Kysely read adapter for tenant-scoped audit evidence. */
@Injectable()
export class KyselyAuditEventsRepository implements AuditEventsRepositoryPort {
  constructor(private readonly db: TenantScopedDb) {}

  async list(input: ListAuditEventsInput): Promise<Page<AuditEvent>> {
    const rows = await this.db.withTenant(input.tenantId, (trx) => {
      let query = trx
        .selectFrom('audit_events')
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(input.limit + 1);

      if (input.outcome) {
        query = query.where('outcome', '=', input.outcome);
      }
      if (input.correlationId) {
        query = query.where('correlation_id', '=', input.correlationId);
      }
      if (input.cursor) {
        const position = decodeCursor(input.cursor);
        query = query.where(
          sql<boolean>`(created_at, id) < (${position.createdAt}::timestamptz, ${position.id}::uuid)`,
        );
      }
      return query.execute();
    });

    return toPage(rows.map(toAuditEvent), input.limit);
  }
}
