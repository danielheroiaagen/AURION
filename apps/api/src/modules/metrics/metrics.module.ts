import { Module } from '@nestjs/common';

import { METRICS_REPOSITORY } from './application/metrics.repository.port';
import { MetricsService } from './application/metrics.service';
import { KyselyMetricsRepository } from './infrastructure/kysely-metrics.repository';
import { MetricsController } from './http/metrics.controller';

/** Supervision metrics surface (ADR-023). */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: METRICS_REPOSITORY, useClass: KyselyMetricsRepository }],
})
export class MetricsModule {}
