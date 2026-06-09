import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { CORRELATION_ID_KEY } from '../correlation/correlation-id.middleware';
import { codeForStatus, type ProblemDetails } from './problem-details';

/**
 * Global exception filter that converts every error into the Problem Details
 * contract (ADR-009). It:
 *  - never leaks stack traces or internal messages for 5xx responses,
 *  - preserves safe client-facing messages for HttpExceptions (4xx),
 *  - stamps each response with the request correlation id,
 *  - logs 5xx with full context server-side for debugging.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemDetails');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId =
      ((request as unknown as Record<string, unknown>)[CORRELATION_ID_KEY] as string) ?? 'unknown';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const problem: ProblemDetails = {
      type: 'about:blank',
      title: this.titleForStatus(status),
      status,
      detail: this.detailFor(exception, status),
      code: codeForStatus(status),
      correlation_id: correlationId,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify({ correlationId, status, message: this.rawMessage(exception) }),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).type('application/problem+json').json(problem);
  }

  private detailFor(exception: unknown, status: number): string {
    // Never expose internals on server errors.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'An unexpected error occurred.';
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return body;
      }
      if (body && typeof body === 'object') {
        const message = (body as Record<string, unknown>).message;
        if (Array.isArray(message)) {
          return message.join('; ');
        }
        if (typeof message === 'string') {
          return message;
        }
      }
      return exception.message;
    }
    return 'Request could not be processed.';
  }

  private rawMessage(exception: unknown): string {
    return exception instanceof Error ? exception.message : String(exception);
  }

  private titleForStatus(status: number): string {
    return status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal Server Error' : 'Request Error';
  }
}
