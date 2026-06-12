import { Module } from '@nestjs/common';

import { TRANSCRIPT_REPOSITORY } from './application/transcript.repository.port';
import { TranscriptService } from './application/transcript.service';
import { VOICE_SESSIONS_REPOSITORY } from './application/voice-sessions.repository.port';
import { VoiceSessionsService } from './application/voice-sessions.service';
import { KyselyTranscriptRepository } from './infrastructure/kysely-transcript.repository';
import { KyselyVoiceSessionsRepository } from './infrastructure/kysely-voice-sessions.repository';
import { VoiceSessionsController } from './http/voice-sessions.controller';

/** Voice sessions contract group (ADR-009, ADR-013) + transcript QA (ADR-039). */
@Module({
  controllers: [VoiceSessionsController],
  providers: [
    VoiceSessionsService,
    TranscriptService,
    { provide: VOICE_SESSIONS_REPOSITORY, useClass: KyselyVoiceSessionsRepository },
    { provide: TRANSCRIPT_REPOSITORY, useClass: KyselyTranscriptRepository },
  ],
})
export class VoiceSessionsModule {}
