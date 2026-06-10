import { Injectable, Logger } from '@nestjs/common';

import { TenantScopedDb } from '../../../database/tenant-scope';
import type { AuthorizationAuditPort } from '../application/authorization-audit.port';
import type { AuthorizationAuditEvidence } from '../domain/authorization';
import { isActorType } from '../domain/actor';
import { LoggingAuditSink } from './logging-audit.sink';

/**
 * Database-backed adapter for the authorization audit port (ADR-012): persists
 * evidence to the append-only `audit_events` table inside the evidence's tenant
 * scope, so the RLS policy and append-only trigger from migration 0002 are the
 * hard guarantees.
 *
 * The port stays synchronous for callers; the insert is dispatched
 * asynchronously. Evidence is never silently dropped: anything the database
 * cannot accept (no tenant context — RLS rejects it by design — an unknown
 * actor reference, or an outage) falls back to the structured logging sink.
 */
@Injectable()
export class DbAuditSink implements AuthorizationAuditPort {
  private readonly logger = new Logger('AuthorizationAudit');

  constructor(
    private readonly db: TenantScopedDb,
    private readonly fallback: LoggingAuditSink,
  ) {}

  record(evidence: AuthorizationAuditEvidence): void {
    const { tenantId, actorType } = evidence;
    if (!tenantId || !isActorType(actorType)) {
      this.fallback.record(evidence);
      return;
    }

    void this.db
      .withTenant(tenantId, (trx) =>
        trx
          .insertInto('audit_events')
          .values({
            tenant_id: tenantId,
            actor_type: actorType,
            // FK targets users/memberships; machine actors carry no user row.
            actor_user_id: actorType === 'user' ? evidence.actorId : null,
            action: evidence.permission,
            resource_type: 'authorization_decision',
            resource_id: null,
            outcome: evidence.outcome,
            correlation_id: evidence.correlationId ?? 'unknown',
            metadata: JSON.stringify(
              evidence.reason ? { reason: evidence.reason } : {},
            ),
          })
          .execute(),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `audit_events insert failed; evidence preserved in logs: ${String(error)}`,
        );
        this.fallback.record(evidence);
      });
  }
}
