import type { Page } from '../../../common/pagination/cursor';
import type { AuditOutcome, DbActorType } from '../../../database/database.schema';

/** Audit event as the application layer sees it. Read-only by design. */
export interface AuditEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly actorType: DbActorType;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly outcome: AuditOutcome;
  readonly correlationId: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface ListAuditEventsInput {
  readonly tenantId: string;
  readonly outcome?: AuditOutcome;
  readonly correlationId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

/**
 * Outbound read port for audit evidence (ADR-009 "Audit" group). There is
 * deliberately no write surface here: evidence is produced by the audit sink
 * and the table is append-only at the database layer (migration 0002).
 */
export interface AuditEventsRepositoryPort {
  list(input: ListAuditEventsInput): Promise<Page<AuditEvent>>;
}

/** DI token for the audit events repository port. */
export const AUDIT_EVENTS_REPOSITORY = Symbol('AUDIT_EVENTS_REPOSITORY');
