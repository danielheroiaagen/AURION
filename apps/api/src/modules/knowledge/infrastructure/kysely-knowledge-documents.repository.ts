import { Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';

import { mapPgError } from '../../../common/errors/pg-error';
import { decodeCursor, toPage, type Page } from '../../../common/pagination/cursor';
import type { KnowledgeDocumentsTable } from '../../../database/database.schema';
import { TenantScopedDb } from '../../../database/tenant-scope';
import type { KnowledgeDocumentStatus } from '../domain/knowledge-document';
import type {
  CreateKnowledgeDocumentInput,
  KnowledgeDocument,
  KnowledgeDocumentsRepositoryPort,
  ListKnowledgeDocumentsInput,
} from '../application/knowledge-documents.repository.port';

function toDocument(row: Selectable<KnowledgeDocumentsTable>): KnowledgeDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    sourceUri: row.source_uri,
    contentSha256: row.content_sha256,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Kysely adapter for the knowledge documents port. Every query runs inside the
 * tenant scope (RLS hard guarantee); pagination follows the opaque-cursor
 * contract with `(created_at, id) DESC` total ordering.
 */
@Injectable()
export class KyselyKnowledgeDocumentsRepository implements KnowledgeDocumentsRepositoryPort {
  constructor(private readonly db: TenantScopedDb) {}

  async create(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    try {
      const row = await this.db.withTenant(input.tenantId, (trx) =>
        trx
          .insertInto('knowledge_documents')
          .values({
            tenant_id: input.tenantId,
            title: input.title,
            source_uri: input.sourceUri,
            content_sha256: input.contentSha256,
            created_by_user_id: input.createdByUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
      return toDocument(row);
    } catch (error) {
      mapPgError(error, {
        conflict: 'A document with the same content already exists in this tenant.',
        reference: 'Creator is not a member of this tenant.',
      });
    }
  }

  async findById(tenantId: string, id: string): Promise<KnowledgeDocument | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('knowledge_documents')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
    );
    return row ? toDocument(row) : null;
  }

  async list(input: ListKnowledgeDocumentsInput): Promise<Page<KnowledgeDocument>> {
    const rows = await this.db.withTenant(input.tenantId, (trx) => {
      let query = trx
        .selectFrom('knowledge_documents')
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

    return toPage(rows.map(toDocument), input.limit);
  }

  async transitionStatus(
    tenantId: string,
    id: string,
    expectedStatus: KnowledgeDocumentStatus,
    nextStatus: KnowledgeDocumentStatus,
  ): Promise<KnowledgeDocument | null> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .updateTable('knowledge_documents')
        .set({
          status: nextStatus,
          updated_at: sql`now()`,
          // First publication stamps the timestamp; later transitions keep it.
          ...(nextStatus === 'published' ? { published_at: sql`now()` } : {}),
        })
        .where('id', '=', id)
        .where('status', '=', expectedStatus)
        .returningAll()
        .executeTakeFirst(),
    );
    return row ? toDocument(row) : null;
  }
}
