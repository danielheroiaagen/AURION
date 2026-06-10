import { subjectOf } from '../domain/actor';
import type {
  AuthorizationDecision,
  AuthorizationRequest,
  DenyReason,
} from '../domain/authorization';
import { roleGrants } from '../domain/permission-matrix';
import {
  isSensitive,
  isTenantScoped,
  isToolExecution,
  requiresHumanApproval,
} from '../domain/permissions';
import type { AuthorizationAuditPort } from './authorization-audit.port';

/**
 * The single authorization decision point for AURION (ADR-007).
 *
 * Controllers and NestJS guards must delegate here; business rules never live in
 * controllers. The service is framework-free (pure TypeScript) so it is fully
 * unit-testable and reusable across transports.
 *
 * Decision order (fail closed at the first failing check):
 *   1. There must be an actor and a resolvable policy subject.
 *   2. Tenant-scoped permissions require a tenant id and a matching tenant
 *      (platform owners may operate cross-tenant).
 *   3. The subject's role/type must grant the permission (deny by default).
 *   4. Human-approval-gated actions require an approval; Voice Agents need
 *      approval for any tool execution.
 *   5. Sensitive decisions (approved or denied) leave audit evidence.
 */
export class PolicyService {
  constructor(private readonly audit: AuthorizationAuditPort) {}

  authorize(request: AuthorizationRequest): AuthorizationDecision {
    const { actor, permission } = request;
    const sensitive = isSensitive(permission);

    const deny = (reason: DenyReason): AuthorizationDecision => {
      const decision: AuthorizationDecision = {
        allowed: false,
        permission,
        reason,
        requiresAudit: sensitive,
      };
      this.emit(request, decision);
      return decision;
    };

    const grantFailure = this.checkGrant(request);
    if (grantFailure) {
      return deny(grantFailure);
    }

    if (this.needsHumanApproval(request) && !request.humanApproval?.approved) {
      return deny('human_approval_required');
    }

    const decision: AuthorizationDecision = {
      allowed: true,
      permission,
      requiresAudit: sensitive,
    };
    this.emit(request, decision);
    return decision;
  }

  /**
   * Evaluate the grant (actor, tenant scope, role) WITHOUT the human-approval
   * gate, reporting whether execution will require approval (ADR-013).
   *
   * This is the decision point for the *request* stage of approval-gated
   * actions: requesting must be possible before any approval record exists.
   * `authorize` remains the only method that can green-light *execution*.
   * Sensitive decisions emit audit evidence exactly like `authorize`.
   */
  assessGrant(
    request: Omit<AuthorizationRequest, 'humanApproval'>,
  ): AuthorizationDecision & { readonly requiresHumanApproval: boolean } {
    const { permission } = request;
    const sensitive = isSensitive(permission);
    const reason = this.checkGrant(request);

    const decision: AuthorizationDecision = reason
      ? { allowed: false, permission, reason, requiresAudit: sensitive }
      : { allowed: true, permission, requiresAudit: sensitive };
    this.emit(request, decision);
    return { ...decision, requiresHumanApproval: this.needsHumanApproval(request) };
  }

  /** Shared actor / tenant / role checks; null means the grant holds. */
  private checkGrant(
    request: Omit<AuthorizationRequest, 'humanApproval'>,
  ): DenyReason | null {
    const { actor, permission } = request;

    if (!actor) {
      return 'no_actor';
    }

    const subject = subjectOf(actor);
    if (!subject) {
      return 'no_subject';
    }

    if (isTenantScoped(permission)) {
      const resourceTenant = request.resource.tenantId;
      if (!resourceTenant) {
        return 'missing_tenant';
      }
      // Platform owners are global operators and may cross tenant boundaries.
      if (actor.role !== 'platform_owner') {
        if (!actor.tenantId || actor.tenantId !== resourceTenant) {
          return 'cross_tenant';
        }
      }
    }

    if (!roleGrants(subject, permission)) {
      return 'role_not_permitted';
    }
    return null;
  }

  private needsHumanApproval(request: Omit<AuthorizationRequest, 'humanApproval'>): boolean {
    return (
      requiresHumanApproval(request.permission) ||
      (request.actor?.type === 'voice_agent' && isToolExecution(request.permission))
    );
  }

  private emit(request: AuthorizationRequest, decision: AuthorizationDecision): void {
    if (!decision.requiresAudit) {
      return;
    }
    this.audit.record({
      actorId: request.actor?.id ?? null,
      actorType: request.actor?.type ?? null,
      tenantId: request.resource.tenantId ?? request.actor?.tenantId ?? null,
      permission: decision.permission,
      outcome: decision.allowed ? 'allowed' : 'denied',
      reason: decision.reason,
      correlationId: request.correlationId,
    });
  }
}
