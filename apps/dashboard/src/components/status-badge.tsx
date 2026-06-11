import type { ReactNode } from 'react';

import { Badge } from './ui/badge';

const TONE: Record<string, 'ok' | 'warn' | 'danger'> = {
  // shared
  active: 'ok',
  // actions
  requested: 'warn',
  approved: 'ok',
  executed: 'ok',
  rejected: 'danger',
  failed: 'danger',
  cancelled: 'danger',
  // sessions / users / knowledge
  started: 'warn',
  completed: 'ok',
  invited: 'warn',
  disabled: 'danger',
  draft: 'warn',
  review: 'warn',
  published: 'ok',
  archived: 'danger',
  // audit
  allowed: 'ok',
  succeeded: 'ok',
  denied: 'danger',
};

export function StatusBadge({ status }: { status: string }): ReactNode {
  return <Badge tone={TONE[status] ?? 'neutral'}>{status}</Badge>;
}
