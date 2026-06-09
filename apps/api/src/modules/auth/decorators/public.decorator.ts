import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route as public (no authentication required). */
export const IS_PUBLIC_KEY = 'aurion:public';

/**
 * Mark a controller or handler as public. The global authentication guard skips
 * token verification for these routes. Use sparingly — deny by default is the
 * rule; only truly unauthenticated endpoints (health, readiness) qualify.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
