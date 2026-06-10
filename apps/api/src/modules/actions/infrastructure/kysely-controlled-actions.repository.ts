import { Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';

import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service';
import { mapPgError } from '../../../common/errors/pg-error';
import { decodeCursor, toPage, type Page } from '../../../common/pagination/cursor';
import type { ControlledActionsTable } from '../../../database/database.schema';
import { TenantScopedDb } from '../../../database/tenant-scope';
import type { ActionType, ControlledActionStatus } from '../domain/controlled-action';
import type {
  ControlledAction,
  ControlledActionsRepositoryPort,
  CreateControlledActionInput,
  ListControlledActionsInput,
  TransitionControlledActionFields,
} from '../application/controlled-actions.repository.port';

/** JSONB wrapper for encrypted payloads at rest (ADR-011/ADR-013). */
interface CipherEnvelope {
  ciphertext: string;
}

function isCipherEnvelope(value: unknown): value is CipherEnvelope {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as CipherEnvelope).ciphertext === 'string'
  );
}

/**
 * Kysely adapter for the controlled actions port. Every query runs inside the
 * tenant scope (RLS hard guarantee). Request/result payloads are encrypted
 * before they reach the database — the JSONB column stores
 * `{"ciphertext": "enc:v1:…"}` — and decrypted only on reads through this
 * adapter. Plain objects (none expected) are passed through for tolerance.
 */
@Injectable()
export class KyselyControlledActionsRepository implements ControlledActionsRepositoryPort {
  constructor(
    private readonly db: TenantScopedDb,
    private readonly crypto: FieldEncryptionService,
  ) {}

  private sealPayload(payload: Record<string, unknown>): string {
    return JSON.stringify({ ciphertext: this.crypto.encrypt(JSON.stringify(payload)) });
  }

  private openPayload(stored: Record<string, unknown> | null): Record<string, unknown> | null {
    if (stored === null) {
      return null;
    }
    if (isCipherEnvelope(stored)) {
      return JSON.parse(this.crypto.decrypt(stored.ciphertext)) as Record<string, unknown>;
    }
    return stored;
  }

  private toAction(row: Selectable<ControlledActionsTable>): ControlledAction {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      voiceSessionId: row.voice_session_id,
      actionType: row.action_type as ActionType,
      status: row.status,
      actorType: row.actor_type,
      actorUserId: row.actor_user_id,
      idempotencyKey: row.idempotency_key,
      requestPayload: this.openPayload(row.request_payload) ?? {},
      resultPayload: this.openPayload(row.result_payload),
      approvalRequired: row.approval_required,
      approvedByUserId: row.approved_by_user_id,
      correlationId: row.correlation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(input: CreateControlledActionInput): Promise<ControlledAction> {
    try {
      const row = await this.db.withTenant(input.tenantId, (trx) =>
        trx
          .insertInto('controlled_actions')
          .values({
            tenant_id: input.tenantId,
            voice_session_id: input.voiceSessionId,
            action_type: input.actionType,
            actor_type: input.actorType,
            actor_user_id: input.actorUserId,
            idempotency_key: input.idempotencyKey,
            request_payload: this.sealPayload(input.requestPayload),
            approval_required: input.approvalRequired,
            correlation_id: input.correlationId,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
      return this.toAction(row);
    } catch (error) {
      mapPgError(error, {
        conflict: 'An action with this Idempotency-Key already exists.',
        reference: 'Request references an unknown session or tenant member.',
      });
    }
  }

  async findById(tenantId: string, id: string): Promise<ControlledAction | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx.selectFrom('controlled_actions').selectAll().where('id', '=', id).executeTakeFirst(),
    );
    return row ? this.toAction(row) : null;
  }

  async findByIdempotencyKey(tenantId: string, key: string): Promise<ControlledAction | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('controlled_actions')
        .selectAll()
        .where('idempotency_key', '=', key)
        .executeTakeFirst(),
    );
    return row ? this.toAction(row) : null;
  }

  async list(input: ListControlledActionsInput): Promise<Page<ControlledAction>> {
    const rows = await this.db.withTenant(input.tenantId, (trx) => {
      let query = trx
        .selectFrom('controlled_actions')
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
      rows.map((row) => this.toAction(row)),
      input.limit,
    );
  }

  async transitionStatus(
    tenantId: string,
    id: string,
    expectedStatus: ControlledActionStatus,
    nextStatus: ControlledActionStatus,
    fields?: TransitionControlledActionFields,
  ): Promise<ControlledAction | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .updateTable('controlled_actions')
        .set({
          status: nextStatus,
          updated_at: sql`now()`,
          ...(fields?.approvedByUserId !== undefined
            ? { approved_by_user_id: fields.approvedByUserId }
            : {}),
          ...(fields?.resultPayload !== undefined
            ? { result_payload: this.sealPayload(fields.resultPayload) }
            : {}),
        })
        .where('id', '=', id)
        .where('status', '=', expectedStatus)
        .returningAll()
        .executeTakeFirst(),
    );
    return row ? this.toAction(row) : null;
  }
}
