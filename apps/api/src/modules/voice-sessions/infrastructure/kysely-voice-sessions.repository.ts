import { Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';

import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service';
import { decodeCursor, toPage, type Page } from '../../../common/pagination/cursor';
import type { VoiceSessionsTable } from '../../../database/database.schema';
import { TenantScopedDb } from '../../../database/tenant-scope';
import type { VoiceSessionStatus } from '../domain/voice-session';
import type {
  CloseVoiceSessionFields,
  CreateVoiceSessionInput,
  ListVoiceSessionsInput,
  VoiceSession,
  VoiceSessionsRepositoryPort,
} from '../application/voice-sessions.repository.port';

/**
 * Kysely adapter for the voice sessions port. Every query runs inside the
 * tenant scope (RLS hard guarantee), and `summary` is encrypted before it
 * reaches the database (ADR-011/ADR-013): a database-only compromise yields
 * ciphertext. The `isEncrypted` check keeps reads tolerant of legacy
 * plaintext rather than failing them.
 */
@Injectable()
export class KyselyVoiceSessionsRepository implements VoiceSessionsRepositoryPort {
  constructor(
    private readonly db: TenantScopedDb,
    private readonly crypto: FieldEncryptionService,
  ) {}

  private toSession(row: Selectable<VoiceSessionsTable>): VoiceSession {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      externalSessionId: row.external_session_id,
      startedByUserId: row.started_by_user_id,
      status: row.status,
      transcriptUri: row.transcript_uri,
      summary:
        row.summary !== null && this.crypto.isEncrypted(row.summary)
          ? this.crypto.decrypt(row.summary)
          : row.summary,
      outcome: row.outcome,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(input: CreateVoiceSessionInput): Promise<VoiceSession> {
    const row = await this.db.withTenant(input.tenantId, (trx) =>
      trx
        .insertInto('voice_sessions')
        .values({
          tenant_id: input.tenantId,
          external_session_id: input.externalSessionId,
          started_by_user_id: input.startedByUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
    return this.toSession(row);
  }

  async findById(tenantId: string, id: string): Promise<VoiceSession | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx.selectFrom('voice_sessions').selectAll().where('id', '=', id).executeTakeFirst(),
    );
    return row ? this.toSession(row) : null;
  }

  async findByExternalSessionId(
    tenantId: string,
    externalSessionId: string,
  ): Promise<VoiceSession | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('voice_sessions')
        .selectAll()
        .where('external_session_id', '=', externalSessionId)
        .executeTakeFirst(),
    );
    return row ? this.toSession(row) : null;
  }

  async list(input: ListVoiceSessionsInput): Promise<Page<VoiceSession>> {
    const rows = await this.db.withTenant(input.tenantId, (trx) => {
      let query = trx
        .selectFrom('voice_sessions')
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(input.limit + 1);

      if (input.status) {
        query = query.where('status', '=', input.status);
      }
      if (input.cursor) {
        const position = decodeCursor(input.cursor);
        query = query.where(
          sql<boolean>`(created_at, id) < (${position.createdAt}::timestamptz, ${position.id}::uuid)`,
        );
      }
      return query.execute();
    });

    return toPage(
      rows.map((row) => this.toSession(row)),
      input.limit,
    );
  }

  async transitionStatus(
    tenantId: string,
    id: string,
    expectedStatus: VoiceSessionStatus,
    nextStatus: VoiceSessionStatus,
    closeFields?: CloseVoiceSessionFields,
  ): Promise<VoiceSession | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .updateTable('voice_sessions')
        .set({
          status: nextStatus,
          updated_at: sql`now()`,
          ...(closeFields
            ? {
                ended_at: sql`now()`,
                ...(closeFields.summary !== undefined
                  ? { summary: this.crypto.encrypt(closeFields.summary) }
                  : {}),
                ...(closeFields.outcome !== undefined ? { outcome: closeFields.outcome } : {}),
                ...(closeFields.transcriptUri !== undefined
                  ? { transcript_uri: closeFields.transcriptUri }
                  : {}),
              }
            : {}),
        })
        .where('id', '=', id)
        .where('status', '=', expectedStatus)
        .returningAll()
        .executeTakeFirst(),
    );
    return row ? this.toSession(row) : null;
  }
}
