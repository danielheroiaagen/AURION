import { Module } from '@nestjs/common';

import { AUDIT_EVENTS_REPOSITORY } from './application/audit-events.repository.port';
import { KyselyAuditEventsRepository } from './infrastructure/kysely-audit-events.repository';
import { AuditEventsController } from './http/audit-events.controller';

/** Audit evidence contract group (ADR-009, ADR-012). Read-only. */
@Module({
  controllers: [AuditEventsController],
  providers: [{ provide: AUDIT_EVENTS_REPOSITORY, useClass: KyselyAuditEventsRepository }],
})
export class AuditModule {}
