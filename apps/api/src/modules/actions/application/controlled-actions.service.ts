import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Page } from '../../../common/pagination/cursor';
import { PolicyService } from '../../auth/application/policy.service';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { canonicalJson, toolPermission, type ActionType } from '../domain/controlled-action';
import {
  ACTION_DISPATCHER,
  type ActionDispatcherPort,
} from './action-dispatcher.port';
import {
  CONTROLLED_ACTIONS_REPOSITORY,
  type ControlledAction,
  type ControlledActionsRepositoryPort,
  type ListControlledActionsInput,
} from './controlled-actions.repository.port';

export interface RequestActionInput {
  readonly actionType: ActionType;
  readonly voiceSessionId: string | null;
  readonly requestPayload: Record<string, unknown>;
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

/**
 * Controlled action use cases (ADR-013): the request → approve/reject →
 * execute workflow around the policy decision point.
 *
 * - Requesting checks the grant via `assessGrant` (no approval gate yet) and
 *   records whether execution will require human approval.
 * - Approving/rejecting requires a human actor whose role grants the tool
 *   permission; the requester can never approve their own action.
 * - Executing re-authorizes via `authorize`, passing the database-recorded
 *   approval — never a client-supplied flag.
 */
@Injectable()
export class ControlledActionsService {
  constructor(
    @Inject(CONTROLLED_ACTIONS_REPOSITORY)
    private readonly actions: ControlledActionsRepositoryPort,
    @Inject(ACTION_DISPATCHER)
    private readonly dispatcher: ActionDispatcherPort,
    private readonly policy: PolicyService,
  ) {}

  async request(
    actor: AuthenticatedActor,
    tenantId: string,
    input: RequestActionInput,
  ): Promise<{ action: ControlledAction; created: boolean }> {
    const permission = toolPermission(input.actionType);
    const assessment = this.policy.assessGrant({
      actor,
      permission,
      resource: { tenantId },
      correlationId: input.correlationId,
    });
    if (!assessment.allowed) {
      throw new ForbiddenException({ message: 'Access denied.', reason: assessment.reason });
    }

    const replayed = await this.findReplay(tenantId, input);
    if (replayed) {
      return { action: replayed, created: false };
    }

    try {
      const action = await this.actions.create({
        tenantId,
        voiceSessionId: input.voiceSessionId,
        actionType: input.actionType,
        actorType: actor.type,
        actorUserId: actor.type === 'user' ? actor.id : null,
        idempotencyKey: input.idempotencyKey,
        requestPayload: input.requestPayload,
        approvalRequired: assessment.requiresHumanApproval,
        correlationId: input.correlationId,
      });
      return { action, created: true };
    } catch (error) {
      // Concurrent request with the same key won the race: settle as a replay.
      if (error instanceof ConflictException) {
        const settled = await this.findReplay(tenantId, input);
        if (settled) {
          return { action: settled, created: false };
        }
      }
      throw error;
    }
  }

  /**
   * Resolve an idempotent replay: same key + same canonical payload returns
   * the original action; same key + different payload is a 409 (a key
   * identifies one logical request, never two — ADR-013).
   */
  private async findReplay(
    tenantId: string,
    input: RequestActionInput,
  ): Promise<ControlledAction | null> {
    const existing = await this.actions.findByIdempotencyKey(tenantId, input.idempotencyKey);
    if (!existing) {
      return null;
    }
    if (
      existing.actionType !== input.actionType ||
      canonicalJson(existing.requestPayload) !== canonicalJson(input.requestPayload)
    ) {
      throw new ConflictException(
        'Idempotency-Key was already used with a different request payload.',
      );
    }
    return existing;
  }

  async getById(tenantId: string, id: string): Promise<ControlledAction> {
    const action = await this.actions.findById(tenantId, id);
    if (!action) {
      throw new NotFoundException('Action not found.');
    }
    return action;
  }

  async list(input: ListControlledActionsInput): Promise<Page<ControlledAction>> {
    return this.actions.list(input);
  }

  async approve(
    actor: AuthenticatedActor,
    tenantId: string,
    id: string,
    correlationId: string,
  ): Promise<ControlledAction> {
    const action = await this.requireDecisionAuthority(actor, tenantId, id, correlationId);
    const updated = await this.actions.transitionStatus(tenantId, id, 'requested', 'approved', {
      approvedByUserId: actor.id,
    });
    if (!updated) {
      throw new ConflictException(`Action is no longer in "requested" state (${action.status}).`);
    }
    return updated;
  }

  async reject(
    actor: AuthenticatedActor,
    tenantId: string,
    id: string,
    correlationId: string,
  ): Promise<ControlledAction> {
    const action = await this.requireDecisionAuthority(actor, tenantId, id, correlationId);
    const updated = await this.actions.transitionStatus(tenantId, id, 'requested', 'rejected');
    if (!updated) {
      throw new ConflictException(`Action is no longer in "requested" state (${action.status}).`);
    }
    return updated;
  }

  async execute(
    actor: AuthenticatedActor,
    tenantId: string,
    id: string,
    correlationId: string,
  ): Promise<ControlledAction> {
    const action = await this.getById(tenantId, id);

    // Approval-gated actions execute from `approved`; non-gated actions skip
    // the decision stage and execute directly from `requested` (ADR-013).
    const expectedStatus = action.approvalRequired ? 'approved' : 'requested';
    if (action.status !== expectedStatus) {
      throw new ConflictException(`Action in state "${action.status}" cannot be executed.`);
    }

    // The only execution green-light: the policy decision point, fed with the
    // approval recorded in the database (ADR-013) — never a client flag.
    const decision = this.policy.authorize({
      actor,
      permission: toolPermission(action.actionType),
      resource: { tenantId },
      humanApproval: action.approvalRequired
        ? {
            approved: action.status === 'approved',
            approverId: action.approvedByUserId ?? undefined,
          }
        : { approved: true },
      correlationId,
    });
    if (!decision.allowed) {
      throw new ForbiddenException({ message: 'Access denied.', reason: decision.reason });
    }

    // Execution evidence comes from the dispatcher, never the client
    // (ADR-014). Failures are persisted as `failed` evidence BEFORE the 502
    // surfaces: the record never depends on the client handling the response.
    const dispatch = await this.dispatcher.dispatch({
      actionId: action.id,
      tenantId,
      actionType: action.actionType,
      requestPayload: action.requestPayload,
      correlationId,
    });

    if (!dispatch.ok) {
      const failed = await this.actions.transitionStatus(tenantId, id, expectedStatus, 'failed', {
        resultPayload: { error: { code: dispatch.errorCode, message: dispatch.message } },
      });
      if (!failed) {
        throw new ConflictException('Action state changed concurrently during dispatch; retry.');
      }
      throw new BadGatewayException({
        message: 'Action dispatch failed.',
        code: dispatch.errorCode,
      });
    }

    const updated = await this.actions.transitionStatus(tenantId, id, expectedStatus, 'executed', {
      resultPayload: dispatch.resultPayload,
    });
    if (!updated) {
      throw new ConflictException('Action state changed concurrently; retry.');
    }
    return updated;
  }

  /**
   * Approval authority (ADR-013): a human actor whose role grants the tool
   * permission, and never the requester of the action itself.
   */
  private async requireDecisionAuthority(
    actor: AuthenticatedActor,
    tenantId: string,
    id: string,
    correlationId: string,
  ): Promise<ControlledAction> {
    if (actor.type !== 'user') {
      throw new ForbiddenException('Only human actors can approve or reject actions.');
    }
    const action = await this.getById(tenantId, id);
    if (action.actorUserId === actor.id) {
      throw new ForbiddenException('Requester cannot approve or reject their own action.');
    }
    const assessment = this.policy.assessGrant({
      actor,
      permission: toolPermission(action.actionType),
      resource: { tenantId },
      correlationId,
    });
    if (!assessment.allowed) {
      throw new ForbiddenException({ message: 'Access denied.', reason: assessment.reason });
    }
    return action;
  }
}
