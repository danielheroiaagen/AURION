import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';

import { loadSecurityConfig } from '../../src/config/security.config';
import { JwtVerificationError } from '../../src/modules/auth/infrastructure/jwt-claims';
import { JwksJwtVerifier } from '../../src/modules/auth/infrastructure/jwks.verifier';

const NOW = 1_765_000_000; // fixed epoch seconds
const ISSUER = 'https://idp.example.test/';
const AUDIENCE = 'aurion-api';
const JWKS_URL = 'https://idp.example.test/.well-known/jwks.json';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: rogueKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function signRs256(
  payload: Record<string, unknown>,
  options: { kid?: string; alg?: string; key?: KeyObject } = {},
): string {
  const header = { alg: options.alg ?? 'RS256', typ: 'JWT', kid: options.kid ?? 'key-1' };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(options.key ?? privateKey);
  return `${signingInput}.${signature.toString('base64url')}`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sub: 'user-1',
    tenant_id: 'tenant-1',
    role: 'tenant_admin',
    actor_type: 'user',
    exp: NOW + 600,
    iss: ISSUER,
    aud: AUDIENCE,
    ...overrides,
  };
}

function jwksResponse(keys: unknown[]): Response {
  return { ok: true, status: 200, json: async () => ({ keys }) } as unknown as Response;
}

function exportJwk(kid: string): Record<string, unknown> {
  return { ...(publicKey.export({ format: 'jwk' }) as Record<string, unknown>), kid, alg: 'RS256' };
}

describe('security config: AUTH_MODE', () => {
  const HS_ENV = { JWT_SECRET: 's'.repeat(32) };

  it('defaults to hs256 and keeps the JWT_SECRET fail-closed contract', () => {
    expect(loadSecurityConfig(HS_ENV).auth.mode).toBe('hs256');
    expect(() => loadSecurityConfig({})).toThrow(/JWT_SECRET/);
    expect(() => loadSecurityConfig({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('rejects unknown modes', () => {
    expect(() => loadSecurityConfig({ AUTH_MODE: 'oauth' })).toThrow(/hs256.*jwks/);
  });

  it('jwks mode fails closed without https URL, issuer, and audience', () => {
    expect(() => loadSecurityConfig({ AUTH_MODE: 'jwks' })).toThrow(/AUTH_JWKS_URL/);
    expect(() =>
      loadSecurityConfig({ AUTH_MODE: 'jwks', AUTH_JWKS_URL: 'http://idp.test/jwks' }),
    ).toThrow(/https/);
    expect(() =>
      loadSecurityConfig({ AUTH_MODE: 'jwks', AUTH_JWKS_URL: JWKS_URL, JWT_ISSUER: ISSUER }),
    ).toThrow(/JWT_AUDIENCE/);
  });

  it('jwks mode does NOT require a symmetric secret', () => {
    const config = loadSecurityConfig({
      AUTH_MODE: 'jwks',
      AUTH_JWKS_URL: JWKS_URL,
      JWT_ISSUER: ISSUER,
      JWT_AUDIENCE: AUDIENCE,
    });
    expect(config.auth).toEqual({
      mode: 'jwks',
      jwks: { url: JWKS_URL, issuer: ISSUER, audience: AUDIENCE, cacheTtlSec: 600 },
    });
  });
});

describe('JwksJwtVerifier', () => {
  let fetchMock: jest.Mock;
  let clock: number;

  function makeVerifier(overrides: Record<string, unknown> = {}): JwksJwtVerifier {
    return new JwksJwtVerifier({
      jwksUrl: JWKS_URL,
      issuer: ISSUER,
      audience: AUDIENCE,
      now: () => clock,
      ...overrides,
    });
  }

  beforeEach(() => {
    clock = NOW;
    fetchMock = jest.fn().mockResolvedValue(jwksResponse([exportJwk('key-1')]));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('verifies a valid RS256 token and normalizes the actor', async () => {
    const actor = await makeVerifier().verify(signRs256(validClaims()));
    expect(actor).toEqual({
      id: 'user-1',
      tenantId: 'tenant-1',
      type: 'user',
      role: 'tenant_admin',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches keys: repeated verifications hit the JWKS endpoint once', async () => {
    const verifier = makeVerifier();
    await verifier.verify(signRs256(validClaims()));
    await verifier.verify(signRs256(validClaims({ sub: 'user-2' })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects algorithm confusion: HS256 and none never reach key lookup', async () => {
    const verifier = makeVerifier();
    const hsToken = `${b64url(JSON.stringify({ alg: 'HS256', kid: 'key-1' }))}.${b64url(
      JSON.stringify(validClaims()),
    )}.${b64url('whatever')}`;
    await expect(verifier.verify(hsToken)).rejects.toBeInstanceOf(JwtVerificationError);

    const noneToken = `${b64url(JSON.stringify({ alg: 'none' }))}.${b64url(
      JSON.stringify(validClaims()),
    )}.`;
    await expect(verifier.verify(noneToken)).rejects.toBeInstanceOf(JwtVerificationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects tokens signed by a key outside the JWKS document', async () => {
    await expect(
      makeVerifier().verify(signRs256(validClaims(), { key: rogueKey })),
    ).rejects.toThrow('Invalid signature.');
  });

  it('enforces expiry, issuer, and audience pinning', async () => {
    const verifier = makeVerifier();
    await expect(verifier.verify(signRs256(validClaims({ exp: NOW - 120 })))).rejects.toThrow(
      'Token has expired.',
    );
    await expect(
      verifier.verify(signRs256(validClaims({ iss: 'https://evil.test/' }))),
    ).rejects.toThrow('Invalid issuer (iss) claim.');
    await expect(verifier.verify(signRs256(validClaims({ aud: 'other-api' })))).rejects.toThrow(
      'Invalid audience (aud) claim.',
    );
  });

  it('picks up rotated keys after the cooldown (no restart needed)', async () => {
    const verifier = makeVerifier({ refreshCooldownSec: 60 });
    await verifier.verify(signRs256(validClaims()));

    // The IdP rotates: a new kid appears in the document.
    fetchMock.mockResolvedValue(jwksResponse([exportJwk('key-2')]));
    clock += 61; // past the cooldown
    const actor = await verifier.verify(signRs256(validClaims(), { kid: 'key-2' }));
    expect(actor.id).toBe('user-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rate-limits unknown-kid refetches (bogus-kid flood cannot DoS the IdP)', async () => {
    const verifier = makeVerifier({ refreshCooldownSec: 60 });
    await verifier.verify(signRs256(validClaims()));

    for (let i = 0; i < 5; i += 1) {
      await expect(
        verifier.verify(signRs256(validClaims(), { kid: `bogus-${i}` })),
      ).rejects.toThrow('Unknown signing key.');
    }
    // First fetch + at most zero extra within the cooldown window.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps serving from the cache when the JWKS endpoint goes down', async () => {
    const verifier = makeVerifier({ cacheTtlSec: 10, refreshCooldownSec: 0 });
    await verifier.verify(signRs256(validClaims()));

    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    clock += 30; // cache TTL expired → refresh attempted and fails
    const actor = await verifier.verify(signRs256(validClaims({ sub: 'user-3' })));
    expect(actor.id).toBe('user-3');
  });

  it('fails closed when there is no cache and the endpoint is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(makeVerifier().verify(signRs256(validClaims()))).rejects.toThrow(
      'Unknown signing key.',
    );
  });
});
