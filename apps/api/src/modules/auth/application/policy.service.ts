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

    if (!actor) {
      return deny('no_actor');
    }

    const subject = subjectOf(actor);
    if (!subject) {
      return deny('no_subject');
    }

    if (isTenantScoped(permission)) {
      const resourceTenant = request.resource.tenantId;
      if (!resourceTenant) {
        return deny('missing_tenant');
      }
      // Platform owners are global operators and may cross tenant boundaries.
      if (actor.role !== 'platform_owner') {
        if (!actor.tenantId || actor.tenantId !== resourceTenant) {
          return deny('cross_tenant');
        }
      }
    }

    if (!roleGrants(subject, permission)) {
      return deny('role_not_permitted');
    }

    const needsApproval =
      requiresHumanApproval(permission) ||
      (actor.type === 'voice_agent' && isToolExecution(permission));
    if (needsApproval && !request.humanApproval?.approved) {
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
