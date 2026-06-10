import { describe, expect, it, vi } from 'vitest';

import { ApiClient, ApiError } from '../src/api/client';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('ApiClient', () => {
  it('sends the bearer token, prefixes /api/v1 and serializes params', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], next_cursor: null }));
    const client = new ApiClient({ getToken: () => 'tok-1', fetchImpl });

    await client.get('/actions', { status: 'requested', limit: 25, cursor: undefined });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/actions?');
    expect(url).toContain('status=requested');
    expect(url).toContain('limit=25');
    expect(url).not.toContain('cursor');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok-1');
  });

  it('sends Idempotency-Key and JSON body on POST', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'a-1' }));
    const client = new ApiClient({ getToken: () => 'tok-1', fetchImpl });

    await client.post('/actions', { action_type: 'ticket.create' }, 'key-123');

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBe('key-123');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ action_type: 'ticket.create' });
  });

  it('maps Problem Details errors and exposes the detail message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(409, {
        title: 'Conflict',
        status: 409,
        detail: 'Action is no longer in "requested" state.',
        correlation_id: 'corr-1',
      }),
    );
    const client = new ApiClient({ getToken: () => 'tok-1', fetchImpl });

    const error = await client.post('/actions/a-1/approve').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toContain('no longer in');
    expect((error as ApiError).problem.correlation_id).toBe('corr-1');
  });

  it('treats any 401 as session death', async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { status: 401 }));
    const client = new ApiClient({ getToken: () => 'stale', onUnauthorized, fetchImpl });

    await expect(client.get('/users')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
