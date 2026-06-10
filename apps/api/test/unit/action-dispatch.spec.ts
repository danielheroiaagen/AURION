import { createHmac } from 'node:crypto';

import { loadDispatchConfig } from '../../src/config/dispatch.config';
import type { DispatchInput } from '../../src/modules/actions/application/action-dispatcher.port';
import { HermesHttpDispatcher } from '../../src/modules/actions/infrastructure/hermes-http.dispatcher';
import { NoopDispatcher } from '../../src/modules/actions/infrastructure/noop.dispatcher';

const INPUT: DispatchInput = {
  actionId: '22222222-2222-4222-8222-222222222222',
  tenantId: '11111111-1111-4111-8111-111111111111',
  actionType: 'ticket.create',
  requestPayload: { subject: 'help' },
  correlationId: 'corr-1',
};

const SECRET = 's'.repeat(32);

describe('loadDispatchConfig', () => {
  it('defaults to noop mode', () => {
    expect(loadDispatchConfig({})).toEqual({ mode: 'noop', hermes: null });
  });

  it('rejects unknown modes', () => {
    expect(() => loadDispatchConfig({ ACTION_DISPATCH_MODE: 'yolo' })).toThrow(/noop.*hermes/);
  });

  it('fails closed in hermes mode without URL or with a non-https URL', () => {
    expect(() => loadDispatchConfig({ ACTION_DISPATCH_MODE: 'hermes' })).toThrow(
      /HERMES_DISPATCH_URL/,
    );
    expect(() =>
      loadDispatchConfig({
        ACTION_DISPATCH_MODE: 'hermes',
        HERMES_DISPATCH_URL: 'http://hermes.internal/dispatch',
        HERMES_DISPATCH_SECRET: SECRET,
      }),
    ).toThrow(/https/);
  });

  it('fails closed in hermes mode without a strong secret', () => {
    expect(() =>
      loadDispatchConfig({
        ACTION_DISPATCH_MODE: 'hermes',
        HERMES_DISPATCH_URL: 'https://hermes.internal/dispatch',
        HERMES_DISPATCH_SECRET: 'short',
      }),
    ).toThrow(/HERMES_DISPATCH_SECRET/);
  });

  it('allows private-network plain http only with the explicit flag (ADR-020)', () => {
    const config = loadDispatchConfig({
      ACTION_DISPATCH_MODE: 'hermes',
      HERMES_DISPATCH_URL: 'http://hermes-receiver:8090/dispatch',
      HERMES_DISPATCH_SECRET: SECRET,
      HERMES_DISPATCH_ALLOW_INSECURE_HTTP: 'true',
    });
    expect(config.hermes?.url).toBe('http://hermes-receiver:8090/dispatch');
  });

  it('accepts a complete hermes configuration (and localhost http for dev)', () => {
    const config = loadDispatchConfig({
      ACTION_DISPATCH_MODE: 'hermes',
      HERMES_DISPATCH_URL: 'http://localhost:8080/dispatch',
      HERMES_DISPATCH_SECRET: SECRET,
      HERMES_DISPATCH_TIMEOUT_MS: '500',
    });
    expect(config.mode).toBe('hermes');
    expect(config.hermes).toEqual({
      url: 'http://localhost:8080/dispatch',
      secret: SECRET,
      timeoutMs: 500,
    });
  });
});

describe('NoopDispatcher', () => {
  it('succeeds and honestly stamps the result as noop', async () => {
    const result = await new NoopDispatcher().dispatch(INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resultPayload).toMatchObject({
        dispatch_mode: 'noop',
        action_id: INPUT.actionId,
        action_type: INPUT.actionType,
      });
    }
  });
});

describe('HermesHttpDispatcher', () => {
  const config = { url: 'https://hermes.internal/dispatch', secret: SECRET, timeoutMs: 1000 };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function jsonResponse(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  }

  it('sends a timestamp-bound HMAC-SHA256 signature over the exact body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ticket_id: 'T-1' }));

    const result = await new HermesHttpDispatcher(config).dispatch(INPUT);
    expect(result).toEqual({ ok: true, resultPayload: { ticket_id: 'T-1' } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(config.url);
    const headers = init.headers as Record<string, string>;
    const expected = createHmac('sha256', SECRET)
      .update(`${headers['x-aurion-timestamp']}.${init.body as string}`)
      .digest('hex');
    expect(headers['x-aurion-signature']).toBe(`sha256=${expected}`);
    expect(headers['x-correlation-id']).toBe(INPUT.correlationId);
    expect(JSON.parse(init.body as string)).toMatchObject({
      action_id: INPUT.actionId,
      tenant_id: INPUT.tenantId,
      action_type: INPUT.actionType,
      request_payload: INPUT.requestPayload,
    });
  });

  it('maps non-2xx responses to a dispatch_rejected failure (never throws)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: 'down' }));
    const result = await new HermesHttpDispatcher(config).dispatch(INPUT);
    expect(result).toMatchObject({ ok: false, errorCode: 'dispatch_rejected' });
  });

  it('maps malformed response bodies to dispatch_invalid_response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('not json');
      },
    } as unknown as Response);
    expect(await new HermesHttpDispatcher(config).dispatch(INPUT)).toMatchObject({
      ok: false,
      errorCode: 'dispatch_invalid_response',
    });

    fetchMock.mockResolvedValue(jsonResponse(200, [1, 2, 3]));
    expect(await new HermesHttpDispatcher(config).dispatch(INPUT)).toMatchObject({
      ok: false,
      errorCode: 'dispatch_invalid_response',
    });
  });

  it('maps timeouts to dispatch_timeout', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);
    expect(await new HermesHttpDispatcher(config).dispatch(INPUT)).toMatchObject({
      ok: false,
      errorCode: 'dispatch_timeout',
    });
  });

  it('maps network errors to dispatch_unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await new HermesHttpDispatcher(config).dispatch(INPUT)).toMatchObject({
      ok: false,
      errorCode: 'dispatch_unreachable',
    });
  });
});
