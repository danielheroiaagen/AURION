import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedActor } from '../domain/actor';

/** Request property where the authentication guard stores the verified actor. */
export const ACTOR_REQUEST_KEY = 'aurionActor';

/**
 * Inject the verified actor into a controller handler. Returns `undefined` on
 * public routes where no actor was established.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor | undefined => {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    return request[ACTOR_REQUEST_KEY] as AuthenticatedActor | undefined;
  },
);
