import { createHmac } from 'node:crypto';

import { JwtVerificationError, JwtVerifier } from '../../src/modules/auth/infrastructure/jwt.verifier';

const SECRET = 'unit-test-secret-unit-test-secret-0123456789';
const NOW = 1_000_000;

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(
  payload: Record<string, unknown>,
  secret = SECRET,
  header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' },
): string {
  const head = encode(header);
  const body = encode(payload);
  const signature = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

function makeVerifier(overrides: Partial<ConstructorParameters<typeof JwtVerifier>[0]> = {}) {
  return new JwtVerifier({ secret: SECRET, now: () => NOW, ...overrides });
}

describe('JwtVerifier', () => {
  it('rejects a secret shorter than 32 characters', () => {
    expect(() => new JwtVerifier({ secret: 'too-short' })).toThrow(JwtVerificationError);
  });

  it('verifies a well-formed HS256 token and normalizes the actor', () => {
    const token = sign({
      sub: 'user-1',
      tenant_id: 'tenant-1',
      role: 'tenant_admin',
      actor_type: 'user',
      exp: NOW + 60,
    });

    const actor = makeVerifier().verify(token);

    expect(actor).toEqual({
      id: 'user-1',
      tenantId: 'tenant-1',
      type: 'user',
      role: 'tenant_admin',
    });
  });

  it('defaults actor type to user and role to null when absent', () => {
    const token = sign({ sub: 'user-2', exp: NOW + 60 });
    const actor = makeVerifier().verify(token);
    expect(actor.type).toBe('user');
    expect(actor.role).toBeNull();
  });

  it('rejects the "none" algorithm', () => {
    const token = sign({ sub: 'x', exp: NOW + 60 }, SECRET, { alg: 'none', typ: 'JWT' });
    expect(() => makeVerifier().verify(token)).toThrow(/algorithm/i);
  });

  it('rejects a tampered signature', () => {
    const token = sign({ sub: 'x', exp: NOW + 60 });
    const tampered = `${token.slice(0, -2)}xx`;
    expect(() => makeVerifier().verify(tampered)).toThrow(/signature|base64url/i);
  });

  it('rejects a token signed with a different secret', () => {
    const token = sign({ sub: 'x', exp: NOW + 60 }, 'another-secret-another-secret-0123456789');
    expect(() => makeVerifier().verify(token)).toThrow(/signature/i);
  });

  it('rejects an expired token (beyond clock tolerance)', () => {
    const token = sign({ sub: 'x', exp: NOW - 120 });
    expect(() => makeVerifier().verify(token)).toThrow(/expired/i);
  });

  it('requires the exp claim', () => {
    const token = sign({ sub: 'x' });
    expect(() => makeVerifier().verify(token)).toThrow(/expiration/i);
  });

  it('rejects a not-yet-valid token', () => {
    const token = sign({ sub: 'x', exp: NOW + 600, nbf: NOW + 300 });
    expect(() => makeVerifier().verify(token)).toThrow(/not yet valid/i);
  });

  it('requires the sub claim', () => {
    const token = sign({ exp: NOW + 60 });
    expect(() => makeVerifier().verify(token)).toThrow(/subject/i);
  });

  it('rejects an invalid role claim', () => {
    const token = sign({ sub: 'x', role: 'super_root', exp: NOW + 60 });
    expect(() => makeVerifier().verify(token)).toThrow(/role/i);
  });

  it('rejects an invalid actor_type claim', () => {
    const token = sign({ sub: 'x', actor_type: 'robot', exp: NOW + 60 });
    expect(() => makeVerifier().verify(token)).toThrow(/actor_type/i);
  });

  it('validates issuer when configured', () => {
    const token = sign({ sub: 'x', iss: 'evil', exp: NOW + 60 });
    expect(() => makeVerifier({ issuer: 'aurion' }).verify(token)).toThrow(/issuer/i);
  });

  it('validates audience when configured', () => {
    const token = sign({ sub: 'x', aud: 'other', exp: NOW + 60 });
    expect(() => makeVerifier({ audience: 'aurion-api' }).verify(token)).toThrow(/audience/i);
  });

  it('rejects a malformed token', () => {
    expect(() => makeVerifier().verify('not-a-jwt')).toThrow(JwtVerificationError);
  });
});
