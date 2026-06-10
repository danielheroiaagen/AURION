import type { Page } from '../../../common/pagination/cursor';
import type { KnowledgeDocumentStatus } from '../domain/knowledge-document';

/** Knowledge document as the application layer sees it. */
export interface KnowledgeDocument {
  readonly id: string;
  readonly tenantId: string;
  readonly title: string;
  readonly sourceUri: string | null;
  readonly contentSha256: string;
  readonly status: KnowledgeDocumentStatus;
  readonly createdByUserId: string | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateKnowledgeDocumentInput {
  readonly tenantId: string;
  readonly title: string;
  readonly sourceUri: string | null;
  readonly contentSha256: string;
  readonly createdByUserId: string | null;
}

export interface ListKnowledgeDocumentsInput {
  readonly tenantId: string;
  readonly status?: KnowledgeDocumentStatus;
  readonly limit: number;
  readonly cursor?: string;
}

/**
 * Outbound port for knowledge document persistence. Implementations must run
 * inside the tenant scope (RLS) and keep status changes atomic: an update with
 * an `expectedStatus` that no longer matches must affect no rows.
 */
export interface KnowledgeDocumentsRepositoryPort {
  create(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument>;
  findById(tenantId: string, id: string): Promise<KnowledgeDocument | null>;
  list(input: ListKnowledgeDocumentsInput): Promise<Page<KnowledgeDocument>>;
  /**
   * Compare-and-set status transition. Returns the updated document, or null
   * when the document does not exist or its status changed concurrently.
   */
  transitionStatus(
    tenantId: string,
    id: string,
    expectedStatus: KnowledgeDocumentStatus,
    nextStatus: KnowledgeDocumentStatus,
  ): Promise<KnowledgeDocument | null>;
}

/** DI token for the knowledge documents repository port. */
export const KNOWLEDGE_DOCUMENTS_REPOSITORY = Symbol('KNOWLEDGE_DOCUMENTS_REPOSITORY');
