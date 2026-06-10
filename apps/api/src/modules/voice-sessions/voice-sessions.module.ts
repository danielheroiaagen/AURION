import { Module } from '@nestjs/common';

import { VOICE_SESSIONS_REPOSITORY } from './application/voice-sessions.repository.port';
import { VoiceSessionsService } from './application/voice-sessions.service';
import { KyselyVoiceSessionsRepository } from './infrastructure/kysely-voice-sessions.repository';
import { VoiceSessionsController } from './http/voice-sessions.controller';

/** Voice sessions contract group (ADR-009, ADR-013). */
@Module({
  controllers: [VoiceSessionsController],
  providers: [
    VoiceSessionsService,
    { provide: VOICE_SESSIONS_REPOSITORY, useClass: KyselyVoiceSessionsRepository },
  ],
})
export class VoiceSessionsModule {}
