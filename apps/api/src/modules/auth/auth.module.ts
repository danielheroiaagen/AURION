import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { loadSecurityConfig } from '../../config/security.config';
import {
  AUTHORIZATION_AUDIT_PORT,
  type AuthorizationAuditPort,
} from './application/authorization-audit.port';
import { PolicyService } from './application/policy.service';
import { DbAuditSink } from './infrastructure/db-audit.sink';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard';
import { JwtVerifier } from './infrastructure/jwt.verifier';
import { LoggingAuditSink } from './infrastructure/logging-audit.sink';
import { PolicyGuard } from './infrastructure/policy.guard';

/**
 * Wires the authentication and authorization boundary (ADR-007).
 *
 * - `JwtVerifier` and `PolicyService` are framework-light and built via
 *   factories so the hexagonal layering stays intact.
 * - Both guards are registered globally (deny by default): every route requires
 *   a valid identity unless `@Public()`, and protected routes additionally pass
 *   the policy decision point.
 */
@Module({
  providers: [
    {
      provide: JwtVerifier,
      useFactory: (): JwtVerifier => {
        const config = loadSecurityConfig();
        return new JwtVerifier(config.jwt);
      },
    },
    // Evidence persists to append-only `audit_events` (ADR-012); the logging
    // sink stays as the never-drop fallback inside DbAuditSink.
    LoggingAuditSink,
    { provide: AUTHORIZATION_AUDIT_PORT, useClass: DbAuditSink },
    {
      provide: PolicyService,
      useFactory: (audit: AuthorizationAuditPort): PolicyService => new PolicyService(audit),
      inject: [AUTHORIZATION_AUDIT_PORT],
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
  ],
  exports: [PolicyService, JwtVerifier],
})
export class AuthModule {}
