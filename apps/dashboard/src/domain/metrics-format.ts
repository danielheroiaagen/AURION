/**
 * Display formatting for metrics (ADR-023). Rates arrive in [0,1] or null
 * (zero denominator) — null renders as an explicit em dash, never a fake 0%.
 */
export function formatRate(rate: number | null): string {
  if (rate === null) {
    return '—';
  }
  return `${Math.round(rate * 1000) / 10}%`;
}

/** Bar widths for the CSS-only breakdown charts. */
export function toBars(
  record: Readonly<Record<string, number>>,
): Array<{ label: string; count: number; percent: number }> {
  const entries = Object.entries(record).sort(([, a], [, b]) => b - a);
  const max = entries.reduce((highest, [, count]) => Math.max(highest, count), 0);
  return entries.map(([label, count]) => ({
    label,
    count,
    percent: max > 0 ? Math.round((count / max) * 100) : 0,
  }));
}
