import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { Page } from '../../../common/pagination/cursor';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { canTransition, type KnowledgeDocumentStatus } from '../domain/knowledge-document';
import {
  KNOWLEDGE_DOCUMENTS_REPOSITORY,
  type CreateKnowledgeDocumentInput,
  type KnowledgeDocument,
  type KnowledgeDocumentsRepositoryPort,
  type ListKnowledgeDocumentsInput,
} from './knowledge-documents.repository.port';

/**
 * Knowledge base use cases (ADR-009). Owns lifecycle semantics: legal status
 * transitions, optimistic concurrency on transition, creator attribution.
 */
@Injectable()
export class KnowledgeDocumentsService {
  constructor(
    @Inject(KNOWLEDGE_DOCUMENTS_REPOSITORY)
    private readonly documents: KnowledgeDocumentsRepositoryPort,
  ) {}

  async create(
    actor: AuthenticatedActor,
    input: Omit<CreateKnowledgeDocumentInput, 'createdByUserId'>,
  ): Promise<KnowledgeDocument> {
    return this.documents.create({
      ...input,
      // Machine actors carry no user row; attribution stays in audit evidence.
      createdByUserId: actor.type === 'user' ? actor.id : null,
    });
  }

  async getById(tenantId: string, id: string): Promise<KnowledgeDocument> {
    const document = await this.documents.findById(tenantId, id);
    if (!document) {
      throw new NotFoundException('Knowledge document not found.');
    }
    return document;
  }

  async list(input: ListKnowledgeDocumentsInput): Promise<Page<KnowledgeDocument>> {
    return this.documents.list(input);
  }

  async changeStatus(
    tenantId: string,
    id: string,
    nextStatus: KnowledgeDocumentStatus,
  ): Promise<KnowledgeDocument> {
    const current = await this.getById(tenantId, id);
    if (!canTransition(current.status, nextStatus)) {
      throw new ConflictException(
        `Illegal status transition "${current.status}" -> "${nextStatus}".`,
      );
    }

    // Compare-and-set: if the status moved concurrently, no row matches.
    const updated = await this.documents.transitionStatus(
      tenantId,
      id,
      current.status,
      nextStatus,
    );
    if (!updated) {
      throw new ConflictException('Document status changed concurrently; retry.');
    }
    return updated;
  }
}
