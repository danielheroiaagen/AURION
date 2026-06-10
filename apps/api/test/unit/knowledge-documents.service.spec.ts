import { ConflictException, NotFoundException } from '@nestjs/common';

import type {
  CreateKnowledgeDocumentInput,
  KnowledgeDocument,
  KnowledgeDocumentsRepositoryPort,
  ListKnowledgeDocumentsInput,
} from '../../src/modules/knowledge/application/knowledge-documents.repository.port';
import { KnowledgeDocumentsService } from '../../src/modules/knowledge/application/knowledge-documents.service';
import { canTransition } from '../../src/modules/knowledge/domain/knowledge-document';
import type { AuthenticatedActor } from '../../src/modules/auth/domain/actor';
import type { Page } from '../../src/common/pagination/cursor';

const TENANT = '11111111-1111-4111-8111-111111111111';
const DOC_ID = '22222222-2222-4222-8222-222222222222';

const userActor: AuthenticatedActor = {
  id: '33333333-3333-4333-8333-333333333333',
  tenantId: TENANT,
  type: 'user',
  role: 'tenant_admin',
};

const agentActor: AuthenticatedActor = {
  id: 'agent-1',
  tenantId: TENANT,
  type: 'voice_agent',
  role: null,
};

function document(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: DOC_ID,
    tenantId: TENANT,
    title: 'Pricing FAQ',
    sourceUri: null,
    contentSha256: 'a'.repeat(64),
    status: 'draft',
    createdByUserId: userActor.id,
    publishedAt: null,
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
    ...overrides,
  };
}

class FakeRepo implements KnowledgeDocumentsRepositoryPort {
  created: CreateKnowledgeDocumentInput | null = null;
  byId: KnowledgeDocument | null = null;
  transitionResult: KnowledgeDocument | null = null;
  lastTransition: unknown[] = [];

  async create(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    this.created = input;
    return document({ createdByUserId: input.createdByUserId });
  }

  async findById(): Promise<KnowledgeDocument | null> {
    return this.byId;
  }

  async list(_input: ListKnowledgeDocumentsInput): Promise<Page<KnowledgeDocument>> {
    return { items: [document()], nextCursor: null };
  }

  async transitionStatus(...args: unknown[]): Promise<KnowledgeDocument | null> {
    this.lastTransition = args;
    return this.transitionResult;
  }
}

describe('knowledge document lifecycle (domain)', () => {
  it('allows only the documented transitions', () => {
    expect(canTransition('draft', 'review')).toBe(true);
    expect(canTransition('review', 'draft')).toBe(true);
    expect(canTransition('review', 'published')).toBe(true);
    expect(canTransition('published', 'archived')).toBe(true);

    expect(canTransition('draft', 'published')).toBe(false);
    expect(canTransition('draft', 'archived')).toBe(false);
    expect(canTransition('published', 'draft')).toBe(false);
    expect(canTransition('archived', 'draft')).toBe(false);
    expect(canTransition('draft', 'draft')).toBe(false);
  });
});

describe('KnowledgeDocumentsService', () => {
  let repo: FakeRepo;
  let service: KnowledgeDocumentsService;

  beforeEach(() => {
    repo = new FakeRepo();
    service = new KnowledgeDocumentsService(repo);
  });

  it('attributes creation to user actors', async () => {
    await service.create(userActor, {
      tenantId: TENANT,
      title: 'Pricing FAQ',
      sourceUri: null,
      contentSha256: 'a'.repeat(64),
    });
    expect(repo.created?.createdByUserId).toBe(userActor.id);
  });

  it('does not attribute machine actors to a user row', async () => {
    await service.create(agentActor, {
      tenantId: TENANT,
      title: 'Pricing FAQ',
      sourceUri: null,
      contentSha256: 'a'.repeat(64),
    });
    expect(repo.created?.createdByUserId).toBeNull();
  });

  it('404s on unknown document reads', async () => {
    repo.byId = null;
    await expect(service.getById(TENANT, DOC_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects illegal transitions with a conflict', async () => {
    repo.byId = document({ status: 'draft' });
    await expect(service.changeStatus(TENANT, DOC_ID, 'archived')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('applies legal transitions through compare-and-set', async () => {
    repo.byId = document({ status: 'review' });
    repo.transitionResult = document({ status: 'published', publishedAt: new Date() });

    const updated = await service.changeStatus(TENANT, DOC_ID, 'published');
    expect(updated.status).toBe('published');
    expect(repo.lastTransition).toEqual([TENANT, DOC_ID, 'review', 'published']);
  });

  it('conflicts when the status moved concurrently', async () => {
    repo.byId = document({ status: 'review' });
    repo.transitionResult = null; // CAS matched no row.
    await expect(service.changeStatus(TENANT, DOC_ID, 'published')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
