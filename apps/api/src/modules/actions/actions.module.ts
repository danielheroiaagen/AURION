import { Module } from '@nestjs/common';

import { loadDispatchConfig } from '../../config/dispatch.config';
import { AuthModule } from '../auth/auth.module';
import { ACTION_DISPATCHER, type ActionDispatcherPort } from './application/action-dispatcher.port';
import { CONTROLLED_ACTIONS_REPOSITORY } from './application/controlled-actions.repository.port';
import { ControlledActionsService } from './application/controlled-actions.service';
import { HermesHttpDispatcher } from './infrastructure/hermes-http.dispatcher';
import { KyselyControlledActionsRepository } from './infrastructure/kysely-controlled-actions.repository';
import { NoopDispatcher } from './infrastructure/noop.dispatcher';
import { ControlledActionsController } from './http/controlled-actions.controller';

/** Controlled actions contract group (ADR-009, ADR-013, ADR-014). */
@Module({
  imports: [AuthModule],
  controllers: [ControlledActionsController],
  providers: [
    ControlledActionsService,
    { provide: CONTROLLED_ACTIONS_REPOSITORY, useClass: KyselyControlledActionsRepository },
    {
      // Fail-closed adapter selection at startup (ADR-014): hermes mode
      // refuses to boot without a valid endpoint and a strong signing secret.
      provide: ACTION_DISPATCHER,
      useFactory: (): ActionDispatcherPort => {
        const config = loadDispatchConfig();
        return config.mode === 'hermes'
          ? new HermesHttpDispatcher(config.hermes!)
          : new NoopDispatcher();
      },
    },
  ],
})
export class ActionsModule {}
