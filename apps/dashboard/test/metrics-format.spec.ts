import { describe, expect, it } from 'vitest';

import { formatRate, toBars } from '../src/domain/metrics-format';

describe('formatRate', () => {
  it('renders [0,1] rates as percentages with one decimal', () => {
    expect(formatRate(0.6)).toBe('60%');
    expect(formatRate(0.667)).toBe('66.7%');
    expect(formatRate(1)).toBe('100%');
    expect(formatRate(0)).toBe('0%');
  });

  it('renders null (zero denominator) as an explicit dash, never a fake 0%', () => {
    expect(formatRate(null)).toBe('—');
  });
});

describe('toBars', () => {
  it('sorts descending and scales to the maximum', () => {
    expect(toBars({ executed: 3, requested: 6, failed: 1 })).toEqual([
      { label: 'requested', count: 6, percent: 100 },
      { label: 'executed', count: 3, percent: 50 },
      { label: 'failed', count: 1, percent: 17 },
    ]);
  });

  it('handles empty data without dividing by zero', () => {
    expect(toBars({})).toEqual([]);
  });
});
