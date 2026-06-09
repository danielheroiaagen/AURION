import { SetMetadata } from '@nestjs/common';

import type { Permission } from '../domain/permissions';

/** Metadata key carrying the permission a protected handler requires. */
export const REQUIRED_PERMISSION_KEY = 'aurion:permission';

/**
 * Declare the permission a route requires. The global policy guard reads this
 * and delegates the decision to the application `PolicyService` (ADR-007).
 * Routes without this decorator only require authentication.
 */
export const RequirePermission = (permission: Permission): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
