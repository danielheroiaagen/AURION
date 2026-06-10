import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { PolicyService } from '../../src/modules/auth/application/policy.service';
import { ACTOR_REQUEST_KEY } from '../../src/modules/auth/decorators/current-actor.decorator';
import { IS_PUBLIC_KEY } from '../../src/modules/auth/decorators/public.decorator';
import { REQUIRED_PERMISSION_KEY } from '../../src/modules/auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../src/modules/auth/infrastructure/jwt-auth.guard';
import {
  JwtVerificationError,
  type JwtVerifier,
} from '../../src/modules/auth/infrastructure/jwt.verifier';
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
  } as unknown as JwtVerifier;

  it('allows public routes without a token', () => {
    const guard = new JwtAuthGuard(makeReflector({ [IS_PUBLIC_KEY]: true }), verifier);
    expect(guard.canActivate(makeContext({ headers: {} }))).toBe(true);
  });

  it('rejects a request with no bearer token', () => {
    const guard = new JwtAuthGuard(makeReflector({}), verifier);
    expect(() => guard.canActivate(makeContext({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', () => {
    (verifier.verify as jest.Mock).mockImplementation(() => {
      throw new JwtVerificationError('bad');
    });
    const guard = new JwtAuthGuard(makeReflector({}), verifier);
    const ctx = makeContext({ headers: { authorization: 'Bearer bad' } });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('attaches the verified actor for a valid token', () => {
    const actor = { id: 'u', tenantId: 't', type: 'user', role: 'tenant_admin' };
    (verifier.verify as jest.Mock).mockReturnValue(actor);
    const guard = new JwtAuthGuard(makeReflector({}), verifier);
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };
    expect(guard.canActivate(makeContext(request))).toBe(true);
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
});
