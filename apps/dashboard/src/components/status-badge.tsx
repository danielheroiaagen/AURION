import type { ReactNode } from 'react';

import { Badge } from './ui/badge';

const TONE: Record<string, 'ok' | 'warn' | 'danger' | 'neutral'> = {
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
  // operator readiness
  configured: 'ok',
  missing: 'warn',
  // post-call lead quality (Phase-30, ADR-039): hot lead = good news (green),
  // warm = follow-up needed (amber), cold = low-priority (neutral/grey).
  hot: 'ok',
  warm: 'warn',
  cold: 'neutral',
};

export function StatusBadge({ status }: { status: string }): ReactNode {
  return <Badge tone={TONE[status] ?? 'neutral'}>{status}</Badge>;
}
