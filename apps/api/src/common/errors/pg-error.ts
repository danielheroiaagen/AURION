import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

/**
 * Translate well-known PostgreSQL constraint violations into Problem Details
 * compatible HTTP errors, so database integrity rules surface as stable client
 * contracts instead of opaque 500s. Anything unrecognized is rethrown and
 * handled (without leaking internals) by the global filter.
 */

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

function pgCode(error: unknown): string | undefined {
  return typeof (error as { code?: unknown })?.code === 'string'
    ? (error as { code: string }).code
    : undefined;
}

export function mapPgError(error: unknown, context: { conflict?: string; reference?: string }): never {
  switch (pgCode(error)) {
    case UNIQUE_VIOLATION:
      throw new ConflictException(context.conflict ?? 'Resource already exists.');
    case FOREIGN_KEY_VIOLATION:
      throw new UnprocessableEntityException(
        context.reference ?? 'Request references an unknown related resource.',
      );
    default:
      throw error;
  }
}
