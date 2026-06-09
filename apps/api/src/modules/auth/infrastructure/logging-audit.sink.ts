import { Injectable, Logger } from '@nestjs/common';

import type { AuthorizationAuditPort } from '../application/authorization-audit.port';
import type { AuthorizationAuditEvidence } from '../domain/authorization';

/**
 * MVP adapter for the authorization audit port: emits structured evidence to the
 * application logger. It is a real audit seam — the database-backed adapter that
 * persists to the append-only `audit_events` table replaces this binding once
 * the persistence layer (ADR-008) is implemented, with no change to callers.
 */
@Injectable()
export class LoggingAuditSink implements AuthorizationAuditPort {
  private readonly logger = new Logger('AuthorizationAudit');

  record(evidence: AuthorizationAuditEvidence): void {
    this.logger.log(JSON.stringify({ event: 'authorization_decision', ...evidence }));
  }
}
