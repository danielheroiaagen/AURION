import { Injectable } from '@nestjs/common';
import { type Selectable } from 'kysely';

import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service';
import { mapPgError } from '../../../common/errors/pg-error';
import type { VoiceSessionTurnsTable } from '../../../database/database.schema';
import { TenantScopedDb } from '../../../database/tenant-scope';
import type {
  AppendTranscriptInput,
  ConversationTurnRecord,
  TranscriptRepositoryPort,
} from '../application/transcript.repository.port';

/**
 * Kysely adapter for the transcript port (ADR-039). Every query runs inside
 * the tenant scope (RLS hard guarantee), and `text` is encrypted before it
 * reaches the database (ADR-011/ADR-013): a database-only compromise yields
 * ciphertext. The `isEncrypted` check keeps reads tolerant of legacy
 * plaintext rather than failing them.
 */
@Injectable()
export class KyselyTranscriptRepository implements TranscriptRepositoryPort {
  constructor(
    private readonly db: TenantScopedDb,
    private readonly crypto: FieldEncryptionService,
  ) {}

  private toRecord(row: Selectable<VoiceSessionTurnsTable>): ConversationTurnRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      voiceSessionId: row.voice_session_id,
      turnIndex: row.turn_index,
      speaker: row.speaker,
      text: this.crypto.isEncrypted(row.text) ? this.crypto.decrypt(row.text) : row.text,
      createdAt: row.created_at,
    };
  }

  async append(input: AppendTranscriptInput): Promise<number> {
    if (input.turns.length === 0) {
      return 0;
    }
    try {
      const result = await this.db.withTenant(input.tenantId, (trx) =>
        trx
          .insertInto('voice_session_turns')
          .values(
            input.turns.map((turn) => ({
              tenant_id: input.tenantId,
              voice_session_id: input.voiceSessionId,
              turn_index: turn.turnIndex,
              speaker: turn.speaker,
              text: this.crypto.encrypt(turn.text),
            })),
          )
          // Idempotency: a retried batch lands on the same (session, index)
          // unique key and is ignored, never duplicated.
          .onConflict((oc) =>
            oc.columns(['tenant_id', 'voice_session_id', 'turn_index']).doNothing(),
          )
          .executeTakeFirst(),
      );
      return Number(result?.numInsertedOrUpdatedRows ?? 0n);
    } catch (error) {
      mapPgError(error, {
        reference: 'Transcript references an unknown voice session.',
      });
    }
  }

  async list(tenantId: string, voiceSessionId: string): Promise<ConversationTurnRecord[]> {
    const rows = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('voice_session_turns')
        .selectAll()
        .where('voice_session_id', '=', voiceSessionId)
        .orderBy('turn_index', 'asc')
        .execute(),
    );
    return rows.map((row) => this.toRecord(row));
  }
}
