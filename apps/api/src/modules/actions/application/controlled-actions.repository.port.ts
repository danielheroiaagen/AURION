import type { Page } from '../../../common/pagination/cursor';
import type { DbActorType } from '../../../database/database.schema';
import type { ActionType, ControlledActionStatus } from '../domain/controlled-action';

/**
 * Controlled action as the application layer sees it. Payloads are plaintext
 * objects at this boundary: encryption at rest is the repository adapter's
 * concern (ADR-011/ADR-013) and never leaks above the port.
 */
export interface ControlledAction {
  readonly id: string;
  readonly tenantId: string;
  readonly voiceSessionId: string | null;
  readonly actionType: ActionType;
  readonly status: ControlledActionStatus;
  readonly actorType: DbActorType;
  readonly actorUserId: string | null;
  readonly idempotencyKey: string;
  readonly requestPayload: Record<string, unknown>;
  readonly resultPayload: Record<string, unknown> | null;
  readonly approvalRequired: boolean;
  readonly approvedByUserId: string | null;
  readonly correlationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateControlledActionInput {
  readonly tenantId: string;
  readonly voiceSessionId: string | null;
  readonly actionType: ActionType;
  readonly actorType: DbActorType;
  readonly actorUserId: string | null;
  readonly idempotencyKey: string;
  readonly requestPayload: Record<string, unknown>;
  readonly approvalRequired: boolean;
  readonly correlationId: string;
}

export interface ListControlledActionsInput {
  readonly tenantId: string;
  readonly status?: ControlledActionStatus;
  readonly limit: number;
  readonly cursor?: string;
}

/** Extra columns a transition may stamp (ADR-013 workflow). */
export interface TransitionControlledActionFields {
  readonly approvedByUserId?: string;
  readonly resultPayload?: Record<string, unknown>;
}

export interface ControlledActionsRepositoryPort {
  create(input: CreateControlledActionInput): Promise<ControlledAction>;
  findById(tenantId: string, id: string): Promise<ControlledAction | null>;
  findByIdempotencyKey(tenantId: string, key: string): Promise<ControlledAction | null>;
  list(input: ListControlledActionsInput): Promise<Page<ControlledAction>>;
  /**
   * Compare-and-set status transition. Returns the updated action, or null
   * when the action does not exist or its status changed concurrently.
   */
  transitionStatus(
    tenantId: string,
    id: string,
    expectedStatus: ControlledActionStatus,
    nextStatus: ControlledActionStatus,
    fields?: TransitionControlledActionFields,
  ): Promise<ControlledAction | null>;
}

/** DI token for the controlled actions repository port. */
export const CONTROLLED_ACTIONS_REPOSITORY = Symbol('CONTROLLED_ACTIONS_REPOSITORY');
