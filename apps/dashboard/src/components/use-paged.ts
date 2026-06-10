import { useCallback, useEffect, useState } from 'react';

import type { ListResponse } from '../api/types';

/**
 * Cursor pagination hook (ADR-009 contract): opaque `next_cursor`,
 * "load more" appends, any filter change reloads from the first page.
 */
export interface Paged<T> {
  readonly items: T[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly hasMore: boolean;
  loadMore(): void;
  reload(): void;
}

export function usePaged<T>(
  fetchPage: (cursor?: string) => Promise<ListResponse<T>>,
  deps: readonly unknown[],
): Paged<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchPage(append && cursor ? cursor : undefined);
        setItems((previous) => (append ? [...previous, ...page.items] : page.items));
        setCursor(page.next_cursor);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Request failed.');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchPage, cursor],
  );

  const reload = useCallback(() => void load(false), [load]);
  const loadMore = useCallback(() => void load(true), [load]);

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { items, loading, error, hasMore: cursor !== null, loadMore, reload };
}
