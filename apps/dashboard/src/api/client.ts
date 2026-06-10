import type { ProblemDetails } from './types';

/**
 * The only HTTP door in the dashboard (ADR-017): bearer auth, Problem
 * Details error mapping, `Idempotency-Key` support and 401-as-session-death.
 * Pages never call `fetch` directly.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails,
  ) {
    super(describeProblem(status, problem));
    this.name = 'ApiError';
  }
}

function describeProblem(status: number, problem: ProblemDetails): string {
  const message = Array.isArray(problem.message) ? problem.message.join('; ') : problem.message;
  return problem.detail ?? message ?? problem.title ?? `Request failed with status ${status}.`;
}

export interface RequestOptions {
  readonly params?: Record<string, string | number | undefined>;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
}

export interface ApiClientOptions {
  /** Defaults to same-origin (the dev server proxies /api to the local API). */
  readonly baseUrl?: string;
  readonly getToken: () => string | null;
  /** Invoked on any 401: the session is dead, the UI must re-authenticate. */
  readonly onUnauthorized?: () => void;
  readonly fetchImpl?: typeof fetch;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  get<T>(path: string, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    return this.request<T>('POST', path, { body, idempotencyKey });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const base = this.options.baseUrl ?? '';
    const url = new URL(`${base}/api/v1${path}`, window.location.origin);
    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    const token = this.options.getToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (options.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }

    const doFetch = this.options.fetchImpl ?? fetch;
    const response = await doFetch(url.toString(), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 401) {
      this.options.onUnauthorized?.();
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON body: handled below via status.
    }

    if (!response.ok) {
      const problem: ProblemDetails =
        payload && typeof payload === 'object'
          ? { status: response.status, ...(payload as Record<string, unknown>) }
          : { status: response.status };
      throw new ApiError(response.status, problem);
    }
    return payload as T;
  }
}
