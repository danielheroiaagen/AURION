import { BadGatewayException, ConflictException, ForbiddenException } from '@nestjs/common';

import { PolicyService } from '../../src/modules/auth/application/policy.service';
import type { AuthenticatedActor } from '../../src/modules/auth/domain/actor';
import type {
  ActionDispatcherPort,
  DispatchInput,
  DispatchResult,
} from '../../src/modules/actions/application/action-dispatcher.port';
import type {
  ControlledAction,
  ControlledActionsRepositoryPort,
  CreateControlledActionInput,
  ListControlledActionsInput,
  TransitionControlledActionFields,
} from '../../src/modules/actions/application/controlled-actions.repository.port';
import {
  ControlledActionsService,
  type RequestActionInput,
} from '../../src/modules/actions/application/controlled-actions.service';
import {
  canTransition,
  canonicalJson,
} from '../../src/modules/actions/domain/controlled-action';
import type { ControlledActionStatus } from '../../src/modules/actions/domain/controlled-action';
import type { Page } from '../../src/common/pagination/cursor';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ACTION_ID = '22222222-2222-4222-8222-222222222222';

const adminActor: AuthenticatedActor = {
  id: 'admin-1',
  tenantId: TENANT,
  type: 'user',
  role: 'tenant_admin',
};

const supervisorActor: AuthenticatedActor = {
  id: 'supervisor-1',
  tenantId: TENANT,
  type: 'user',
  role: 'supervisor',
};

const agentActor: AuthenticatedActor = {
  id: 'agent-1',
  tenantId: TENANT,
  type: 'voice_agent',
  role: null,
};

function action(overrides: Partial<ControlledAction> = {}): ControlledAction {
  return {
    id: ACTION_ID,
    tenantId: TENANT,
    voiceSessionId: null,
    actionType: 'ticket.create',
    status: 'requested',
    actorType: 'user',
    actorUserId: adminActor.id,
    idempotencyKey: 'key-1',
    requestPayload: { subject: 'help' },
    resultPayload: null,
    approvalRequired: false,
    approvedByUserId: null,
    correlationId: 'corr-1',
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
    ...overrides,
  };
}

function requestInput(overrides: Partial<RequestActionInput> = {}): RequestActionInput {
  return {
    actionType: 'ticket.create',
    voiceSessionId: null,
    requestPayload: { subject: 'help' },
    idempotencyKey: 'key-1',
    correlationId: 'corr-1',
    ...overrides,
  };
}

class FakeRepo implements ControlledActionsRepositoryPort {
  created: CreateControlledActionInput | null = null;
  createResult: ControlledAction | null = null;
  createError: Error | null = null;
  byKey: ControlledAction | null = null;
  byId: ControlledAction | null = null;
  transitionResult: ControlledAction | null = null;
  lastTransition: [string, string, ControlledActionStatus, ControlledActionStatus, TransitionControlledActionFields | undefined] | null =
    null;

  async create(input: CreateControlledActionInput): Promise<ControlledAction> {
    if (this.createError) {
      throw this.createError;
    }
    this.created = input;
    return this.createResult ?? action({ approvalRequired: input.approvalRequired });
  }

  async findById(): Promise<ControlledAction | null> {
    return this.byId;
  }

  async findByIdempotencyKey(): Promise<ControlledAction | null> {
    return this.byKey;
  }

  async list(_input: ListControlledActionsInput): Promise<Page<ControlledAction>> {
    return { items: [action()], nextCursor: null };
  }

  async transitionStatus(
    tenantId: string,
    id: string,
    expected: ControlledActionStatus,
    next: ControlledActionStatus,
    fields?: TransitionControlledActionFields,
  ): Promise<ControlledAction | null> {
    this.lastTransition = [tenantId, id, expected, next, fields];
    return this.transitionResult;
  }
}

describe('controlled action domain', () => {
  it('allows only the documented decision transitions', () => {
    expect(canTransition('requested', 'approved')).toBe(true);
    expect(canTransition('requested', 'rejected')).toBe(true);
    expect(canTransition('approved', 'executed')).toBe(true);
    expect(canTransition('approved', 'failed')).toBe(true);

    expect(canTransition('rejected', 'approved')).toBe(false);
    expect(canTransition('executed', 'requested')).toBe(false);
  });

  it('canonical JSON is independent of key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ f: 3, e: 4 }] } })).toBe(
      canonicalJson({ a: { c: [{ e: 4, f: 3 }], d: 2 }, b: 1 }),
    );
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });
});

class FakeDispatcher implements ActionDispatcherPort {
  result: DispatchResult = { ok: true, resultPayload: { dispatch_mode: 'noop' } };
  lastInput: DispatchInput | null = null;

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    this.lastInput = input;
    return this.result;
  }
}

describe('ControlledActionsService', () => {
  let repo: FakeRepo;
  let dispatcher: FakeDispatcher;
  let service: ControlledActionsService;
  let policy: PolicyService;

  beforeEach(() => {
    repo = new FakeRepo();
    dispatcher = new FakeDispatcher();
    policy = new PolicyService({ record: () => undefined });
    service = new ControlledActionsService(repo, dispatcher, policy);
  });

  describe('request', () => {
    it('creates a non-gated action for a human with the tool permission', async () => {
      const { action: result, created } = await service.request(
        adminActor,
        TENANT,
        requestInput(),
      );
      expect(created).toBe(true);
      expect(result.approvalRequired).toBe(false);
      expect(repo.created).toMatchObject({
        actionType: 'ticket.create',
        actorType: 'user',
        actorUserId: adminActor.id,
        approvalRequired: false,
      });
    });

    it('records approval_required for voice agent tool requests', async () => {
      await service.request(agentActor, TENANT, requestInput());
      expect(repo.created).toMatchObject({
        actorType: 'voice_agent',
        actorUserId: null,
        approvalRequired: true,
      });
    });

    it('denies actors whose role does not grant the tool permission', async () => {
      // Supervisors hold ticket.create but not calendar.update.
      await expect(
        service.request(supervisorActor, TENANT, requestInput({ actionType: 'calendar.update' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.created).toBeNull();
    });

    it('replays the original action for same key + same payload (created=false)', async () => {
      repo.byKey = action({ requestPayload: { b: 1, a: 2 } });
      const { created, action: result } = await service.request(
        adminActor,
        TENANT,
        requestInput({ requestPayload: { a: 2, b: 1 } }),
      );
      expect(created).toBe(false);
      expect(result.id).toBe(ACTION_ID);
      expect(repo.created).toBeNull();
    });

    it('409s for same key + different payload', async () => {
      repo.byKey = action();
      await expect(
        service.request(adminActor, TENANT, requestInput({ requestPayload: { other: true } })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('settles a concurrent same-key race as a replay', async () => {
      repo.createError = new ConflictException('duplicate key');
      const winner = action();
      let calls = 0;
      repo.findByIdempotencyKey = async () => (calls++ === 0 ? null : winner);

      const { created, action: result } = await service.request(
        adminActor,
        TENANT,
        requestInput(),
      );
      expect(created).toBe(false);
      expect(result.id).toBe(winner.id);
    });
  });

  describe('approve / reject', () => {
    it('denies machine actors', async () => {
      await expect(
        service.approve(agentActor, TENANT, ACTION_ID, 'corr'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies self-approval by the requester', async () => {
      repo.byId = action({ actorUserId: adminActor.id });
      await expect(
        service.approve(adminActor, TENANT, ACTION_ID, 'corr'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies approvers whose role does not grant the tool permission', async () => {
      repo.byId = action({ actionType: 'calendar.update', actorUserId: 'someone-else' });
      await expect(
        service.approve(supervisorActor, TENANT, ACTION_ID, 'corr'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('approves and stamps the approver', async () => {
      repo.byId = action({ actorUserId: null, actorType: 'voice_agent' });
      repo.transitionResult = action({ status: 'approved', approvedByUserId: adminActor.id });

      const updated = await service.approve(adminActor, TENANT, ACTION_ID, 'corr');
      expect(updated.status).toBe('approved');
      expect(repo.lastTransition).toEqual([
        TENANT,
        ACTION_ID,
        'requested',
        'approved',
        { approvedByUserId: adminActor.id },
      ]);
    });

    it('rejects through the same authority checks', async () => {
      repo.byId = action({ actorUserId: 'someone-else' });
      repo.transitionResult = action({ status: 'rejected' });
      const updated = await service.reject(adminActor, TENANT, ACTION_ID, 'corr');
      expect(updated.status).toBe('rejected');
    });

    it('conflicts when the action already left the requested state', async () => {
      repo.byId = action({ actorUserId: 'someone-else', status: 'requested' });
      repo.transitionResult = null; // CAS matched no row.
      await expect(
        service.approve(adminActor, TENANT, ACTION_ID, 'corr'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('execute', () => {
    it('executes a non-gated action with the DISPATCHER result, never client input', async () => {
      repo.byId = action({ approvalRequired: false, status: 'requested' });
      repo.transitionResult = action({ status: 'executed' });
      dispatcher.result = { ok: true, resultPayload: { ticket_id: 'T-1' } };

      const updated = await service.execute(adminActor, TENANT, ACTION_ID, 'corr');
      expect(updated.status).toBe('executed');
      expect(repo.lastTransition).toEqual([
        TENANT,
        ACTION_ID,
        'requested',
        'executed',
        { resultPayload: { ticket_id: 'T-1' } },
      ]);
      expect(dispatcher.lastInput).toMatchObject({
        actionId: ACTION_ID,
        tenantId: TENANT,
        actionType: 'ticket.create',
        correlationId: 'corr',
      });
    });

    it('persists failed evidence and surfaces 502 when dispatch fails', async () => {
      repo.byId = action({ approvalRequired: false, status: 'requested' });
      repo.transitionResult = action({ status: 'failed' });
      dispatcher.result = { ok: false, errorCode: 'dispatch_timeout', message: 'timed out' };

      await expect(service.execute(adminActor, TENANT, ACTION_ID, 'corr')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      // The failure was recorded BEFORE the error surfaced (ADR-014).
      expect(repo.lastTransition).toEqual([
        TENANT,
        ACTION_ID,
        'requested',
        'failed',
        { resultPayload: { error: { code: 'dispatch_timeout', message: 'timed out' } } },
      ]);
    });

    it('refuses to execute an approval-gated action that is not approved', async () => {
      repo.byId = action({
        approvalRequired: true,
        status: 'requested',
        actorType: 'voice_agent',
        actorUserId: null,
      });
      await expect(
        service.execute(agentActor, TENANT, ACTION_ID, 'corr'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(dispatcher.lastInput).toBeNull();
    });

    it('lets the voice agent execute once a human approval is recorded', async () => {
      repo.byId = action({
        approvalRequired: true,
        status: 'approved',
        approvedByUserId: adminActor.id,
        actorType: 'voice_agent',
        actorUserId: null,
      });
      repo.transitionResult = action({ status: 'executed' });

      const updated = await service.execute(agentActor, TENANT, ACTION_ID, 'corr');
      expect(updated.status).toBe('executed');
      expect(repo.lastTransition?.[2]).toBe('approved');
    });

    it('never executes terminal actions', async () => {
      for (const status of ['rejected', 'executed', 'failed'] as const) {
        repo.byId = action({ status });
        await expect(
          service.execute(adminActor, TENANT, ACTION_ID, 'corr'),
        ).rejects.toBeInstanceOf(ConflictException);
      }
      expect(dispatcher.lastInput).toBeNull();
    });
  });
});

describe('PolicyService.assessGrant', () => {
  const recorded: unknown[] = [];
  const policy = new PolicyService({ record: (e) => void recorded.push(e) });

  it('grants without the approval gate and reports the approval requirement', () => {
    const agent = agentActor;
    const result = policy.assessGrant({
      actor: agent,
      permission: 'tool:execute:ticket.create',
      resource: { tenantId: TENANT },
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresHumanApproval).toBe(true);

    // authorize() for the same request still denies without approval.
    const decision = policy.authorize({
      actor: agent,
      permission: 'tool:execute:ticket.create',
      resource: { tenantId: TENANT },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('human_approval_required');
  });

  it('still enforces tenant scope and role grants', () => {
    expect(
      policy.assessGrant({
        actor: adminActor,
        permission: 'tool:execute:ticket.create',
        resource: { tenantId: 'other-tenant' },
      }).allowed,
    ).toBe(false);

    expect(
      policy.assessGrant({
        actor: supervisorActor,
        permission: 'tool:execute:calendar.update',
        resource: { tenantId: TENANT },
      }),
    ).toMatchObject({ allowed: false, reason: 'role_not_permitted' });
  });

  it('emits audit evidence for sensitive permissions', () => {
    recorded.length = 0;
    policy.assessGrant({
      actor: adminActor,
      permission: 'tool:execute:ticket.create',
      resource: { tenantId: TENANT },
    });
    expect(recorded).toHaveLength(1);
  });
});
