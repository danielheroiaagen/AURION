import type {
  AurionApiPort,
  RequestedAction,
  StartedSession,
} from '../application/ports.js';

/**
 * AURION REST adapter (ADR-018): the gateway's only door to the system of
 * record, authenticated as a `voice_agent` machine actor. Mirrors the
 * committed OpenAPI contract (snake_case, Problem Details errors,
 * Idempotency-Key on action requests).
 */
export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

interface VoiceSessionShape {
  id: string;
  status: string;
}

interface ActionShape {
  id: string;
  status: string;
  approval_required: boolean;
}

export class AurionApiClient implements AurionApiPort {
  private readonly tokenProvider: () => Promise<string>;

  constructor(
    private readonly baseUrl: string,
    /** Static JWT (hs256 dev) or an async provider (real IdP, ADR-033). */
    token: string | (() => Promise<string>),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.tokenProvider = typeof token === 'string' ? async () => token : token;
  }

  async startSession(externalSessionId: string): Promise<StartedSession> {
    const session = await this.request<VoiceSessionShape>('POST', '/voice-sessions', {
      body: { external_session_id: externalSessionId },
    });
    // New sessions are `started`; a resumed session may already be `active`.
    if (session.status === 'started') {
      await this.request('PATCH', `/voice-sessions/${session.id}/status`, {
        body: { status: 'active' },
      });
    }
    return { sessionId: session.id };
  }

  async listPublishedKnowledge(): Promise<readonly string[]> {
    const page = await this.request<{ items: Array<{ title: string }> }>(
      'GET',
      '/knowledge-documents?status=published&limit=50',
    );
    return page.items.map((item) => item.title);
  }

  async requestAction(input: {
    sessionId: string;
    actionType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<RequestedAction> {
    const action = await this.request<ActionShape>('POST', '/actions', {
      body: {
        action_type: input.actionType,
        voice_session_id: input.sessionId,
        request_payload: input.payload,
      },
      idempotencyKey: input.idempotencyKey,
    });
    return {
      actionId: action.id,
      status: action.status,
      approvalRequired: action.approval_required,
    };
  }

  async getActionStatus(actionId: string): Promise<string> {
    const action = await this.request<ActionShape>('GET', `/actions/${actionId}`);
    return action.status;
  }

  async closeSession(
    sessionId: string,
    status: 'completed' | 'failed',
    fields: { summary?: string; outcome?: string },
  ): Promise<void> {
    await this.request('PATCH', `/voice-sessions/${sessionId}/status`, {
      body: {
        status,
        ...(fields.summary ? { summary: fields.summary } : {}),
        ...(fields.outcome ? { outcome: fields.outcome } : {}),
      },
    });
  }

  private async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; idempotencyKey?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${await this.tokenProvider()}`,
    };
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (options.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON body: handled by status below.
    }

    if (!response.ok) {
      const detail =
        payload && typeof payload === 'object' && 'detail' in payload
          ? String((payload as { detail: unknown }).detail)
          : `AURION API responded ${response.status}.`;
      throw new UpstreamError(response.status, detail);
    }
    return payload as T;
  }
}
