import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PolicyService } from '../application/policy.service';
import { ACTOR_REQUEST_KEY } from '../decorators/current-actor.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedActor } from '../domain/actor';
import type { Permission } from '../domain/permissions';

/**
 * Global authorization guard (ADR-007 step 4): for routes declaring a required
 * permission via `@RequirePermission`, it delegates the decision to the
 * application `PolicyService`. Routes with no required permission only need a
 * valid identity (already enforced by the authentication guard).
 *
 * Note: the guard never trusts a client-supplied human-approval flag. Actions
 * gated on human approval are denied here by design and must be authorized
 * inside the use case that owns the approval record.
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PolicyService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const actor = (request[ACTOR_REQUEST_KEY] as AuthenticatedActor | undefined) ?? null;

    const decision = this.policy.authorize({
      actor,
      permission,
      resource: { tenantId: this.resolveResourceTenant(request) },
      correlationId:
        typeof request.correlationId === 'string' ? request.correlationId : undefined,
    });

    if (!decision.allowed) {
      throw new ForbiddenException({ message: 'Access denied.', reason: decision.reason });
    }
    return true;
  }

  private resolveResourceTenant(request: Record<string, unknown>): string | null {
    const params = (request.params as Record<string, unknown>) ?? {};
    const query = (request.query as Record<string, unknown>) ?? {};
    const body = (request.body as Record<string, unknown>) ?? {};
    const headers = (request.headers as Record<string, unknown>) ?? {};

    const candidate =
      params.tenantId ?? body.tenantId ?? query.tenantId ?? headers['x-tenant-id'];
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  }
}
