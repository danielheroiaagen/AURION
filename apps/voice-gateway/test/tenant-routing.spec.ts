import { describe, expect, it } from 'vitest';

import { loadGatewayConfig } from '../src/config.js';
import { phoneDigits } from '../src/infrastructure/twilio-bridge.js';

const VOICE_PHONE_ENV = {
  AURION_API_URL: 'http://localhost:3000',
  VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
  STT_MODE: 'openai',
  STT_API_KEY: 'sk-testtesttest',
  TTS_MODE: 'openai',
  TTS_API_KEY: 'sk-testtesttest',
  TELEPHONY_MODE: 'twilio',
  TWILIO_AUTH_TOKEN: 'twilio-token-testtesttest',
  TELEPHONY_PUBLIC_URL: 'https://aurion.test',
  // The single-tenant machine identity (its token URL is reused by routes).
  OIDC_TOKEN_URL: 'https://idp.test/realms/aurion/token',
  OIDC_CLIENT_ID: 'aurion-voice-gateway',
  OIDC_CLIENT_SECRET: 'gateway-secret-testtest',
};

describe('phoneDigits', () => {
  it('compares numbers regardless of +, spaces and 00 prefix', () => {
    expect(phoneDigits('+34 651 86 50 93')).toBe('34651865093');
    expect(phoneDigits('0034651865093')).toBe('0034651865093');
    expect(phoneDigits('651865093')).toBe('651865093');
  });
});

describe('tenant routes config (ADR-035, fail closed)', () => {
  it('defaults to no routes (single-tenant)', () => {
    expect(loadGatewayConfig(VOICE_PHONE_ENV).telephony?.routes).toEqual([]);
  });

  it('loads a route with its own machine identity and defaults', () => {
    const config = loadGatewayConfig({
      ...VOICE_PHONE_ENV,
      TELEPHONY_TENANT_ROUTES: JSON.stringify([
        {
          phone: '+34911111111',
          clientKey: 'tenant-uno-client-key-aaaaaaaaaa',
          greeting: 'Bienvenido a la Clínica Uno.',
          voice: 'marin',
          oidcClientId: 'aurion-vg-clinica-uno',
          oidcClientSecret: 'clinica-uno-secret-xx',
        },
      ]),
    });
    const route = config.telephony!.routes[0];
    expect(route.phone).toBe('+34911111111');
    expect(route.greeting).toBe('Bienvenido a la Clínica Uno.');
    expect(route.lang).toBe('es-ES');
    // Per-tenant brand voice (ADR-038); empty string falls back to the default.
    expect(route.voice).toBe('marin');
    expect(route.oidc.clientId).toBe('aurion-vg-clinica-uno');
    // Token URL inherited from the gateway's own OIDC config.
    expect(route.oidc.tokenUrl).toBe('https://idp.test/realms/aurion/token');
  });

  it('rejects malformed JSON, bad numbers, weak keys and missing identity', () => {
    expect(() => loadGatewayConfig({ ...VOICE_PHONE_ENV, TELEPHONY_TENANT_ROUTES: 'not json' })).toThrow(
      /valid JSON/,
    );
    expect(() =>
      loadGatewayConfig({
        ...VOICE_PHONE_ENV,
        TELEPHONY_TENANT_ROUTES: JSON.stringify([{ phone: 'abc', clientKey: 'k'.repeat(32), oidcClientId: 'x', oidcClientSecret: 'secret-xxxx' }]),
      }),
    ).toThrow(/E\.164/);
    expect(() =>
      loadGatewayConfig({
        ...VOICE_PHONE_ENV,
        TELEPHONY_TENANT_ROUTES: JSON.stringify([{ phone: '+34911111111', clientKey: 'short', oidcClientId: 'x', oidcClientSecret: 'secret-xxxx' }]),
      }),
    ).toThrow(/clientKey/);
    expect(() =>
      loadGatewayConfig({
        ...VOICE_PHONE_ENV,
        TELEPHONY_TENANT_ROUTES: JSON.stringify([{ phone: '+34911111111', clientKey: 'k'.repeat(32) }]),
      }),
    ).toThrow(/oidcClientId/);
  });

  it('rejects duplicate phones or keys — never an ambiguous route', () => {
    expect(() =>
      loadGatewayConfig({
        ...VOICE_PHONE_ENV,
        TELEPHONY_TENANT_ROUTES: JSON.stringify([
          { phone: '+34911111111', clientKey: 'key-uno-'.padEnd(32, 'a'), oidcClientId: 'a', oidcClientSecret: 'secret-xxxx' },
          { phone: '+34911111111', clientKey: 'key-dos-'.padEnd(32, 'b'), oidcClientId: 'b', oidcClientSecret: 'secret-yyyy' },
        ]),
      }),
    ).toThrow(/duplicate/);
  });
});
