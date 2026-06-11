import { describe, expect, it, vi } from 'vitest';

import { loadGatewayConfig } from '../src/config.js';
import { AurionApiClient } from '../src/infrastructure/aurion-api.client.js';
import { OidcTokenError, OidcTokenProvider } from '../src/infrastructure/oidc-token-provider.js';

const BASE_ENV = {
  AURION_API_URL: 'http://localhost:3000',
  VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
};

// Deliberately low-entropy fixtures: must never trip the secret scanner.
const OIDC_CONFIG = {
  tokenUrl: 'https://idp.test/auth/realms/aurion/protocol/openid-connect/token',
  clientId: 'aurion-voice-gateway',
  clientSecret: 'client-secret-testtest',
  audience: 'aurion-api',
  timeoutMs: 1_000,
};

describe('machine identity configuration (fail closed, ADR-033)', () => {
  it('accepts a static token OR a real IdP — never neither', () => {
    expect(() => loadGatewayConfig(BASE_ENV)).toThrow(/VOICE_AGENT_TOKEN .* OIDC_TOKEN_URL/);

    const withStatic = loadGatewayConfig({ ...BASE_ENV, VOICE_AGENT_TOKEN: 'a.b.c' });
    expect(withStatic.voiceAgentToken).toBe('a.b.c');
    expect(withStatic.oidc).toBeNull();

    const withIdp = loadGatewayConfig({
      ...BASE_ENV,
      OIDC_TOKEN_URL: OIDC_CONFIG.tokenUrl,
      OIDC_CLIENT_ID: OIDC_CONFIG.clientId,
      OIDC_CLIENT_SECRET: OIDC_CONFIG.clientSecret,
      OIDC_AUDIENCE: 'aurion-api',
    });
    expect(withIdp.voiceAgentToken).toBeNull();
    expect(withIdp.oidc?.clientId).toBe('aurion-voice-gateway');
    expect(withIdp.oidc?.audience).toBe('aurion-api');
  });

  it('refuses a half-configured IdP', () => {
    expect(() =>
      loadGatewayConfig({ ...BASE_ENV, OIDC_TOKEN_URL: OIDC_CONFIG.tokenUrl }),
    ).toThrow(/OIDC_CLIENT_ID/);
  });
});

describe('OidcTokenProvider (client_credentials, cached, single-flight)', () => {
  function tokenResponse(token: string, expiresIn = 300): Response {
    return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), {
      status: 200,
    });
  }

  it('mints once and serves from cache until the early-refresh window', async () => {
    let nowMs = 1_000_000;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('token-1'))
      .mockResolvedValueOnce(tokenResponse('token-2'));
    const provider = new OidcTokenProvider(
      OIDC_CONFIG,
      fetchMock as unknown as typeof fetch,
      () => nowMs,
    );

    expect(await provider.getToken()).toBe('token-1');
    expect(await provider.getToken()).toBe('token-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(OIDC_CONFIG.tokenUrl);
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('aurion-voice-gateway');
    expect(body.get('audience')).toBe('aurion-api');

    // 300s lifetime - 60s early refresh → expired at +240s.
    nowMs += 241_000;
    expect(await provider.getToken()).toBe('token-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('single-flights concurrent mints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse('only-one'));
    const provider = new OidcTokenProvider(OIDC_CONFIG, fetchMock as unknown as typeof fetch);
    const [a, b] = await Promise.all([provider.getToken(), provider.getToken()]);
    expect(a).toBe('only-one');
    expect(b).toBe('only-one');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails loudly when the IdP refuses or vanishes — never an unsigned request', async () => {
    const refused = vi.fn().mockResolvedValue(new Response('denied', { status: 401 }));
    await expect(
      new OidcTokenProvider(OIDC_CONFIG, refused as unknown as typeof fetch).getToken(),
    ).rejects.toThrow(OidcTokenError);

    const empty = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await expect(
      new OidcTokenProvider(OIDC_CONFIG, empty as unknown as typeof fetch).getToken(),
    ).rejects.toThrow(/no access_token/);
  });
});

describe('AurionApiClient with a token provider', () => {
  it('asks the provider per request — refreshed tokens flow automatically', async () => {
    const tokens = ['first-token', 'second-token'];
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const client = new AurionApiClient(
      'http://api.test',
      async () => tokens.shift() ?? 'late-token',
      fetchMock as unknown as typeof fetch,
    );
    await client.listPublishedKnowledge();
    await client.listPublishedKnowledge();
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer first-token');
    expect(fetchMock.mock.calls[1][1].headers.authorization).toBe('Bearer second-token');
  });
});
