import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CONTROLLED_ACTIONS_REPOSITORY } from './application/controlled-actions.repository.port';
import { ControlledActionsService } from './application/controlled-actions.service';
import { KyselyControlledActionsRepository } from './infrastructure/kysely-controlled-actions.repository';
import { ControlledActionsController } from './http/controlled-actions.controller';

/** Controlled actions contract group (ADR-009, ADR-013). */
@Module({
  imports: [AuthModule],
  controllers: [ControlledActionsController],
  providers: [
    ControlledActionsService,
    { provide: CONTROLLED_ACTIONS_REPOSITORY, useClass: KyselyControlledActionsRepository },
  ],
})
export class ActionsModule {}
