import { ForbiddenException } from '@nestjs/common';

import type { AuthenticatedActor } from '../../modules/auth/domain/actor';

/**
 * Resolve the effective tenant for flat resource routes (ADR-009): always the
 * actor's own tenant. Actors without a tenant context (global operators on
 * tenant-scoped resources) are rejected — cross-tenant administration goes
 * through infrastructure tooling, not this API surface (ADR-012).
 */
export function requireActorTenant(actor: AuthenticatedActor | undefined): string {
  if (!actor?.tenantId) {
    throw new ForbiddenException('A tenant context is required for this resource.');
  }
  return actor.tenantId;
}
