import { BadRequestException } from '@nestjs/common';

import { decodeCursor, encodeCursor, toPage } from '../../src/common/pagination/cursor';

const UUID = '0b9c8a52-3c1e-4f8a-9d2b-6e5f4a3b2c1d';

describe('cursor codec', () => {
  it('round-trips a position', () => {
    const position = { createdAt: '2026-06-10T12:00:00.000Z', id: UUID };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('rejects garbage, non-JSON, and invalid fields', () => {
    for (const bad of [
      '%%%not-base64url%%%',
      Buffer.from('not json').toString('base64url'),
      Buffer.from(JSON.stringify({ createdAt: 'yesterday', id: UUID })).toString('base64url'),
      Buffer.from(JSON.stringify({ createdAt: '2026-06-10T12:00:00.000Z', id: 'nope' })).toString(
        'base64url',
      ),
      Buffer.from(JSON.stringify(null)).toString('base64url'),
    ]) {
      expect(() => decodeCursor(bad)).toThrow(BadRequestException);
    }
  });
});

describe('toPage', () => {
  const row = (n: number) => ({
    id: UUID,
    createdAt: new Date(Date.UTC(2026, 5, 10, 12, 0, n)),
    n,
  });

  it('returns all items and no cursor when the page is not full', () => {
    const page = toPage([row(1), row(2)], 5);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('trims the sentinel row and emits a cursor pointing at the last returned item', () => {
    const rows = [row(5), row(4), row(3)];
    const page = toPage(rows, 2);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor as string)).toEqual({
      createdAt: rows[1].createdAt.toISOString(),
      id: UUID,
    });
  });

  it('handles an empty result set', () => {
    const page = toPage([], 10);
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
