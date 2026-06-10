import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Request property and header used to carry the correlation id. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CORRELATION_ID_KEY = 'correlationId';

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Assigns a correlation id to every request so logs, errors, and audit evidence
 * are traceable end to end (ADR-009). Honors a caller-supplied
 * `X-Correlation-Id` when it is well-formed, otherwise generates a UUID. The
 * value is echoed back in the response header.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[CORRELATION_ID_HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const correlationId =
      typeof candidate === 'string' && SAFE_CORRELATION_ID.test(candidate)
        ? candidate
        : randomUUID();

    (req as unknown as Record<string, unknown>)[CORRELATION_ID_KEY] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
