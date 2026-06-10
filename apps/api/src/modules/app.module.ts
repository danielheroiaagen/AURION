import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { CorrelationIdMiddleware } from '../common/correlation/correlation-id.middleware';
import { CryptoModule } from '../common/crypto/crypto.module';
import { ProblemDetailsFilter } from '../common/errors/problem-details.filter';
import { loadSecurityConfig } from '../config/security.config';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { TenantsModule } from './tenants/tenants.module';

/**
 * Application composition root.
 *
 * Global edge controls (ADR-009, security hardening):
 *  - Rate limiting via Throttler (registered first so abuse is shed early).
 *  - Authentication + authorization guards via AuthModule (deny by default).
 *  - Problem Details exception filter for every error response.
 *  - Correlation id middleware for end-to-end traceability.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const { rateLimit } = loadSecurityConfig();
        return {
          throttlers: [{ ttl: rateLimit.ttlSeconds * 1000, limit: rateLimit.limit }],
        };
      },
    }),
    CryptoModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    KnowledgeModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
