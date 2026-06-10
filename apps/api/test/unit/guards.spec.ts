import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { PolicyService } from '../../src/modules/auth/application/policy.service';
import { ACTOR_REQUEST_KEY } from '../../src/modules/auth/decorators/current-actor.decorator';
import { IS_PUBLIC_KEY } from '../../src/modules/auth/decorators/public.decorator';
import { REQUIRED_PERMISSION_KEY } from '../../src/modules/auth/decorators/require-permission.decorator';
import type { TokenVerifier } from '../../src/modules/auth/application/token-verifier.port';
import { JwtAuthGuard } from '../../src/modules/auth/infrastructure/jwt-auth.guard';
import { JwtVerificationError } from '../../src/modules/auth/infrastructure/jwt.verifier';
import { PolicyGuard } from '../../src/modules/auth/infrastructure/policy.guard';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

describe('JwtAuthGuard', () => {
  const verifier = {
    verify: jest.fn(),
  } as unknown as TokenVerifier;

  it('allows public routes without a token', async () => {
    const guard = new JwtAuthGuard(makeReflector({ [IS_PUBLIC_KEY]: true }), verifier);
    await expect(guard.canActivate(makeContext({ headers: {} }))).resolves.toBe(true);
  });

  it('rejects a request with no bearer token', async () => {
    const guard = new JwtAuthGuard(makeReflector({}), verifier);
    await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid token', async () => {
    (verifier.verify as jest.Mock).mockImplementation(() => {
      throw new JwtVerificationError('bad');
    });
    const guard = new JwtAuthGuard(makeReflector({}), verifier);
    const ctx = makeContext({ headers: { authorization: 'Bearer bad' } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the verified actor for a valid token (sync or async verifier)', async () => {
    const actor = { id: 'u', tenantId: 't', type: 'user', role: 'tenant_admin' };
    (verifier.verify as jest.Mock).mockResolvedValue(actor);
    const guard = new JwtAuthGuard(makeReflector({}), verifier);
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request[ACTOR_REQUEST_KEY]).toEqual(actor);
  });
});

describe('PolicyGuard', () => {
  const policy = new PolicyService({ record: () => undefined });

  it('allows public routes', () => {
    const guard = new PolicyGuard(makeReflector({ [IS_PUBLIC_KEY]: true }), policy);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('allows routes with no required permission', () => {
    const guard = new PolicyGuard(makeReflector({}), policy);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('allows when the policy grants the permission', () => {
    const guard = new PolicyGuard(
      makeReflector({ [REQUIRED_PERMISSION_KEY]: 'conversation:read' }),
      policy,
    );
    const request = {
      params: { tenantId: 'tenant-1' },
      [ACTOR_REQUEST_KEY]: { id: 'u', tenantId: 'tenant-1', type: 'user', role: 'tenant_admin' },
    };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it('forbids when the policy denies (cross-tenant)', () => {
    const guard = new PolicyGuard(
      makeReflector({ [REQUIRED_PERMISSION_KEY]: 'conversation:read' }),
      policy,
    );
    const request = {
      params: { tenantId: 'tenant-2' },
      [ACTOR_REQUEST_KEY]: { id: 'u', tenantId: 'tenant-1', type: 'user', role: 'tenant_admin' },
    };
    expect(() => guard.canActivate(makeContext(request))).toThrow(ForbiddenException);
  });

  it('forbids an unauthenticated request to a protected route', () => {
    const guard = new PolicyGuard(
      makeReflector({ [REQUIRED_PERMISSION_KEY]: 'conversation:read' }),
      policy,
    );
    expect(() => guard.canActivate(makeContext({ params: { tenantId: 'tenant-1' } }))).toThrow(
      ForbiddenException,
    );
  });

  it("falls back to the actor's own tenant on flat resource routes", () => {
    const guard = new PolicyGuard(
      makeReflector({ [REQUIRED_PERMISSION_KEY]: 'knowledge:read' }),
      policy,
    );
    const request = {
      params: {},
      [ACTOR_REQUEST_KEY]: { id: 'u', tenantId: 'tenant-1', type: 'user', role: 'tenant_admin' },
    };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it('still denies an explicit client-supplied tenant that mismatches the token', () => {
    const guard = new PolicyGuard(
      makeReflector({ [REQUIRED_PERMISSION_KEY]: 'knowledge:read' }),
      policy,
    );
    const request = {
      headers: { 'x-tenant-id': 'tenant-2' },
      [ACTOR_REQUEST_KEY]: { id: 'u', tenantId: 'tenant-1', type: 'user', role: 'tenant_admin' },
    };
    expect(() => guard.canActivate(makeContext(request))).toThrow(ForbiddenException);
  });
});
