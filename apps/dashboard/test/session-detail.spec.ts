import { describe, expect, it } from 'vitest';

import type { VoiceSessionResponse } from '../src/api/types';

/**
 * Unit tests for session detail types and data-shaping utilities (Phase-30).
 * React component rendering tests are omitted because the test environment
 * does not mount a real DOM (no vitest-environment-jsdom configured). These
 * tests verify the TypeScript contract and data helpers.
 */

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—';
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

const BASE_SESSION: VoiceSessionResponse = {
  id: 'session-1',
  tenant_id: 'tenant-1',
  external_session_id: 'tw-call-1',
  started_by_user_id: null,
  status: 'completed',
  transcript_uri: null,
  summary: 'caller: hello\nagent: Hi there',
  outcome: 'resolved',
  caller_number: '+34612345678',
  ai_summary: null,
  ai_insights: null,
  started_at: '2026-06-12T10:00:00.000Z',
  ended_at: '2026-06-12T10:05:30.000Z',
  created_at: '2026-06-12T10:00:00.000Z',
  updated_at: '2026-06-12T10:05:30.000Z',
};

const SESSION_WITH_AI: VoiceSessionResponse = {
  ...BASE_SESSION,
  ai_summary: 'The caller asked about pricing for the premium plan and expressed strong interest.',
  ai_insights: {
    intent: 'Pricing inquiry',
    caller_name: 'María García',
    callback_number: '+34612345678',
    lead_quality: 'hot',
    action_items: ['Send pricing PDF', 'Schedule demo call'],
    language: 'es-ES',
  },
};

describe('VoiceSessionResponse shape (Phase-30)', () => {
  it('accepts sessions without AI fields (null)', () => {
    const session = BASE_SESSION;
    expect(session.caller_number).toBe('+34612345678');
    expect(session.ai_summary).toBeNull();
    expect(session.ai_insights).toBeNull();
  });

  it('accepts sessions with full AI fields', () => {
    const session = SESSION_WITH_AI;
    expect(session.ai_summary).toContain('pricing');
    expect(session.ai_insights?.lead_quality).toBe('hot');
    expect(session.ai_insights?.action_items).toHaveLength(2);
    expect(session.ai_insights?.caller_name).toBe('María García');
    expect(session.ai_insights?.language).toBe('es-ES');
  });

  it('accepts all valid lead_quality values', () => {
    const qualities = ['hot', 'warm', 'cold', null] as const;
    for (const q of qualities) {
      const session: VoiceSessionResponse = {
        ...BASE_SESSION,
        ai_insights: q !== null ? { lead_quality: q } : null,
      };
      expect(session.ai_insights?.lead_quality ?? null).toBe(q);
    }
  });

  it('accepts session with no caller_number (widget path)', () => {
    const session: VoiceSessionResponse = { ...BASE_SESSION, caller_number: null };
    expect(session.caller_number).toBeNull();
  });
});

describe('formatDuration helper', () => {
  it('returns — when session has no end time', () => {
    expect(formatDuration('2026-06-12T10:00:00Z', null)).toBe('—');
  });

  it('formats sub-minute sessions as seconds', () => {
    expect(formatDuration('2026-06-12T10:00:00Z', '2026-06-12T10:00:45Z')).toBe('45s');
  });

  it('formats sessions over a minute with minutes and seconds', () => {
    expect(formatDuration('2026-06-12T10:00:00Z', '2026-06-12T10:05:30Z')).toBe('5m 30s');
  });

  it('computes duration correctly from the base session fixture', () => {
    expect(formatDuration(BASE_SESSION.started_at, BASE_SESSION.ended_at)).toBe('5m 30s');
  });
});
