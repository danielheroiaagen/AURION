import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ACTOR_REQUEST_KEY } from '../decorators/current-actor.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtVerificationError, JwtVerifier } from './jwt.verifier';

/**
 * Global authentication guard (ADR-007 step 2): verifies the bearer JWT and
 * attaches the normalized actor to the request. It performs authentication only
 * — authorization is the policy guard's job. Public routes are skipped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const token = this.extractBearerToken(request.headers as Record<string, unknown>);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      request[ACTOR_REQUEST_KEY] = this.verifier.verify(token);
    } catch (error) {
      if (error instanceof JwtVerificationError) {
        throw new UnauthorizedException('Invalid token.');
      }
      throw error;
    }
    return true;
  }

  private extractBearerToken(headers: Record<string, unknown>): string | null {
    const header = headers?.authorization;
    if (typeof header !== 'string') {
      return null;
    }
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      return null;
    }
    return value.trim();
  }
}
