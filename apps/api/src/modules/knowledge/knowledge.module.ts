import { Module } from '@nestjs/common';

import { KNOWLEDGE_DOCUMENTS_REPOSITORY } from './application/knowledge-documents.repository.port';
import { KnowledgeDocumentsService } from './application/knowledge-documents.service';
import { KyselyKnowledgeDocumentsRepository } from './infrastructure/kysely-knowledge-documents.repository';
import { KnowledgeDocumentsController } from './http/knowledge-documents.controller';

/** Knowledge base contract group (ADR-009, ADR-012). */
@Module({
  controllers: [KnowledgeDocumentsController],
  providers: [
    KnowledgeDocumentsService,
    { provide: KNOWLEDGE_DOCUMENTS_REPOSITORY, useClass: KyselyKnowledgeDocumentsRepository },
  ],
})
export class KnowledgeModule {}
