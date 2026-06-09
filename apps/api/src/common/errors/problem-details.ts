/**
 * Problem Details error shape (RFC 9457 style), as mandated by ADR-009.
 * Every error response uses this stable contract instead of ad-hoc shapes.
 */
export interface ProblemDetails {
  /** URI reference identifying the problem type. */
  type: string;
  /** Short, human-readable summary. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Human-readable explanation specific to this occurrence. */
  detail: string;
  /** Stable machine-readable error code. */
  code: string;
  /** Correlation id for tracing the request end to end. */
  correlation_id: string;
}

/** Map an HTTP status to a stable, screaming-snake error code. */
export function codeForStatus(status: number): string {
  const known: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };
  return known[status] ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');
}
