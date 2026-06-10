import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { loadSecurityConfig } from '../../config/security.config';
import {
  AUTHORIZATION_AUDIT_PORT,
  type AuthorizationAuditPort,
} from './application/authorization-audit.port';
import { PolicyService } from './application/policy.service';
import { TOKEN_VERIFIER, type TokenVerifier } from './application/token-verifier.port';
import { DbAuditSink } from './infrastructure/db-audit.sink';
import { JwksJwtVerifier } from './infrastructure/jwks.verifier';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard';
import { JwtVerifier } from './infrastructure/jwt.verifier';
import { LoggingAuditSink } from './infrastructure/logging-audit.sink';
import { PolicyGuard } from './infrastructure/policy.guard';

/**
 * Wires the authentication and authorization boundary (ADR-007, ADR-016).
 *
 * - The token verifier and `PolicyService` are framework-light and built via
 *   factories so the hexagonal layering stays intact. `AUTH_MODE` selects
 *   HS256 (dev/test) or JWKS/RS256 (external IdP) fail-closed at startup.
 * - Both guards are registered globally (deny by default): every route requires
 *   a valid identity unless `@Public()`, and protected routes additionally pass
 *   the policy decision point.
 */
@Module({
  providers: [
    {
      provide: TOKEN_VERIFIER,
      useFactory: (): TokenVerifier => {
        const { auth } = loadSecurityConfig();
        return auth.mode === 'jwks'
          ? new JwksJwtVerifier({
              jwksUrl: auth.jwks.url,
              issuer: auth.jwks.issuer,
              audience: auth.jwks.audience,
              cacheTtlSec: auth.jwks.cacheTtlSec,
            })
          : new JwtVerifier(auth.jwt);
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
  exports: [PolicyService, TOKEN_VERIFIER],
})
export class AuthModule {}
