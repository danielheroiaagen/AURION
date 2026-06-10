import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type {
  CreateVoiceSessionInput,
  ListVoiceSessionsInput,
  VoiceSession,
  VoiceSessionsRepositoryPort,
} from '../../src/modules/voice-sessions/application/voice-sessions.repository.port';
import { VoiceSessionsService } from '../../src/modules/voice-sessions/application/voice-sessions.service';
import { canTransition } from '../../src/modules/voice-sessions/domain/voice-session';
import type { AuthenticatedActor } from '../../src/modules/auth/domain/actor';
import type { Page } from '../../src/common/pagination/cursor';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const agentActor: AuthenticatedActor = {
  id: 'agent-1',
  tenantId: TENANT,
  type: 'voice_agent',
  role: null,
};

function session(overrides: Partial<VoiceSession> = {}): VoiceSession {
  return {
    id: SESSION_ID,
    tenantId: TENANT,
    externalSessionId: 'ext-1',
    startedByUserId: null,
    status: 'started',
    transcriptUri: null,
    summary: null,
    outcome: null,
    startedAt: new Date('2026-06-10T10:00:00Z'),
    endedAt: null,
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
    ...overrides,
  };
}

class FakeRepo implements VoiceSessionsRepositoryPort {
  created: CreateVoiceSessionInput | null = null;
  byExternal: VoiceSession | null = null;
  byId: VoiceSession | null = null;
  transitionResult: VoiceSession | null = null;
  lastTransition: unknown[] = [];

  async create(input: CreateVoiceSessionInput): Promise<VoiceSession> {
    this.created = input;
    return session();
  }

  async findById(): Promise<VoiceSession | null> {
    return this.byId;
  }

  async findByExternalSessionId(): Promise<VoiceSession | null> {
    return this.byExternal;
  }

  async list(_input: ListVoiceSessionsInput): Promise<Page<VoiceSession>> {
    return { items: [session()], nextCursor: null };
  }

  async transitionStatus(...args: unknown[]): Promise<VoiceSession | null> {
    this.lastTransition = args;
    return this.transitionResult;
  }
}

describe('voice session lifecycle (domain)', () => {
  it('allows only the documented transitions', () => {
    expect(canTransition('started', 'active')).toBe(true);
    expect(canTransition('started', 'completed')).toBe(true);
    expect(canTransition('started', 'cancelled')).toBe(true);
    expect(canTransition('active', 'completed')).toBe(true);
    expect(canTransition('active', 'failed')).toBe(true);
    expect(canTransition('active', 'cancelled')).toBe(true);

    expect(canTransition('completed', 'active')).toBe(false);
    expect(canTransition('failed', 'started')).toBe(false);
    expect(canTransition('cancelled', 'active')).toBe(false);
    expect(canTransition('active', 'started')).toBe(false);
  });
});

describe('VoiceSessionsService', () => {
  let repo: FakeRepo;
  let service: VoiceSessionsService;

  beforeEach(() => {
    repo = new FakeRepo();
    service = new VoiceSessionsService(repo);
  });

  it('starts a new session and reports created=true', async () => {
    const { created } = await service.start(agentActor, TENANT, 'ext-1');
    expect(created).toBe(true);
    expect(repo.created).toMatchObject({
      tenantId: TENANT,
      externalSessionId: 'ext-1',
      startedByUserId: null, // machine actor: no user attribution row
    });
  });

  it('is idempotent on external_session_id: replay returns the existing session', async () => {
    repo.byExternal = session();
    const { session: result, created } = await service.start(agentActor, TENANT, 'ext-1');
    expect(created).toBe(false);
    expect(result.id).toBe(SESSION_ID);
    expect(repo.created).toBeNull();
  });

  it('404s on unknown session reads', async () => {
    repo.byId = null;
    await expect(service.getById(TENANT, SESSION_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects outcome fields on non-closing transitions', async () => {
    await expect(
      service.changeStatus(TENANT, SESSION_ID, 'active', { summary: 'too early' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects illegal transitions with a conflict', async () => {
    repo.byId = session({ status: 'completed' });
    await expect(
      service.changeStatus(TENANT, SESSION_ID, 'active', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('passes close fields through on closing transitions', async () => {
    repo.byId = session({ status: 'active' });
    repo.transitionResult = session({ status: 'completed', summary: 'all good' });

    const updated = await service.changeStatus(TENANT, SESSION_ID, 'completed', {
      summary: 'all good',
      outcome: 'resolved',
    });
    expect(updated.status).toBe('completed');
    expect(repo.lastTransition).toEqual([
      TENANT,
      SESSION_ID,
      'active',
      'completed',
      { summary: 'all good', outcome: 'resolved' },
    ]);
  });

  it('conflicts when the status moved concurrently', async () => {
    repo.byId = session({ status: 'active' });
    repo.transitionResult = null;
    await expect(
      service.changeStatus(TENANT, SESSION_ID, 'completed', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
