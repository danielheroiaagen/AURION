import type { AuthenticatedActor } from './actor';
import type { Permission } from './permissions';

/**
 * Reasons an authorization decision can be denied. Stable, machine-readable
 * codes so they can be tested, audited, and surfaced through Problem Details
 * without leaking sensitive detail.
 */
export type DenyReason =
  | 'no_actor'
  | 'no_subject'
  | 'missing_tenant'
  | 'cross_tenant'
  | 'role_not_permitted'
  | 'human_approval_required';

export interface HumanApproval {
  readonly approved: boolean;
  readonly approverId?: string;
}

export interface AuthorizationRequest {
  readonly actor: AuthenticatedActor | null;
  readonly permission: Permission;
  readonly resource: {
    /** Tenant that owns the target resource; required for tenant-scoped permissions. */
    readonly tenantId?: string | null;
  };
  readonly humanApproval?: HumanApproval;
  /** Correlation id for tracing the decision through audit evidence. */
  readonly correlationId?: string;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly permission: Permission;
  /** Present only when `allowed` is false. */
  readonly reason?: DenyReason;
  /** True when this decision must be persisted as audit evidence. */
  readonly requiresAudit: boolean;
}

/**
 * Evidence emitted for sensitive authorization decisions (approved or denied).
 */
export interface AuthorizationAuditEvidence {
  readonly actorId: string | null;
  readonly actorType: string | null;
  readonly tenantId: string | null;
  readonly permission: Permission;
  readonly outcome: 'allowed' | 'denied';
  readonly reason?: DenyReason;
  readonly correlationId?: string;
}
