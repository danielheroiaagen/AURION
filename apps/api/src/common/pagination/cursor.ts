import { BadRequestException } from '@nestjs/common';

/**
 * Opaque cursor pagination (ADR-009, ADR-012).
 *
 * List endpoints order by `created_at DESC, id DESC` — a total order, immune to
 * the offset-drift problem when rows are inserted between pages. The cursor
 * encodes the last row's position as base64url JSON; clients must treat it as
 * an opaque token.
 */

export interface CursorPosition {
  /** ISO-8601 `created_at` of the last row on the previous page. */
  readonly createdAt: string;
  /** UUID tiebreaker of the last row on the previous page. */
  readonly id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}

export function decodeCursor(token: string): CursorPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid pagination cursor.');
  }

  const candidate = parsed as Partial<CursorPosition> | null;
  const createdAt = candidate?.createdAt;
  const id = candidate?.id;
  if (
    typeof createdAt !== 'string' ||
    Number.isNaN(Date.parse(createdAt)) ||
    typeof id !== 'string' ||
    !UUID_PATTERN.test(id)
  ) {
    throw new BadRequestException('Invalid pagination cursor.');
  }
  return { createdAt, id };
}

export interface Page<T> {
  readonly items: readonly T[];
  /** Cursor for the next page, or null when this page is the last one. */
  readonly nextCursor: string | null;
}

/**
 * Build a page from `limit + 1` fetched rows: the extra row only signals that
 * a next page exists and is not returned.
 */
export function toPage<T extends { createdAt: Date; id: string }>(
  rows: readonly T[],
  limit: number,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null,
  };
}
