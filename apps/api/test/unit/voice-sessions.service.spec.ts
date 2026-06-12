import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

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
import { AiInsightsDto } from '../../src/modules/voice-sessions/http/voice-sessions.dto';

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
    callerNumber: null,
    aiSummary: null,
    aiInsights: null,
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

  async patchAiSummary(): Promise<VoiceSession | null> {
    return session({ status: 'completed' });
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

describe('AiInsightsDto validation (PATCH ai-summary)', () => {
  async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(AiInsightsDto, body);
    const errors = await validate(dto, { whitelist: true });
    return errors.flatMap((e) => Object.values(e.constraints ?? {}));
  }

  it('accepts a valid payload with string action_items', async () => {
    const errors = await errorsFor({
      intent: 'pricing inquiry',
      action_items: ['Send PDF', 'Schedule call'],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects action_items containing non-string elements (objects, numbers)', async () => {
    const errors = await errorsFor({
      action_items: [{ a: 1 }, 9],
    });
    // Expect at least one validation error — the payload should be rejected.
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts omitting action_items entirely (field is optional)', async () => {
    const errors = await errorsFor({ intent: 'support request' });
    expect(errors).toHaveLength(0);
  });

  it('rejects action_items that is not an array (e.g. a plain string)', async () => {
    const errors = await errorsFor({ action_items: 'not an array' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
