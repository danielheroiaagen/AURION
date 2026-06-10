import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { CORRELATION_ID_KEY } from './correlation-id.middleware';

/**
 * Inject the request correlation id (assigned by `CorrelationIdMiddleware`)
 * into a controller handler, so use cases can stamp audit-friendly metadata
 * such as `controlled_actions.correlation_id` (ADR-008, ADR-013).
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const value = request[CORRELATION_ID_KEY];
    return typeof value === 'string' ? value : 'unknown';
  },
);
