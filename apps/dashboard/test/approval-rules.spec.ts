import { describe, expect, it } from 'vitest';

import type { ControlledActionResponse } from '../src/api/types';
import type { SessionClaims } from '../src/auth/session';
import { canDecide, canExecute, isTerminal } from '../src/domain/approval-rules';

function action(overrides: Partial<ControlledActionResponse> = {}): ControlledActionResponse {
  return {
    id: 'a-1',
    tenant_id: 't-1',
    voice_session_id: null,
    action_type: 'ticket.create',
    status: 'requested',
    actor_type: 'voice_agent',
    actor_user_id: null,
    idempotency_key: 'k-1',
    request_payload: {},
    result_payload: null,
    approval_required: true,
    approved_by_user_id: null,
    correlation_id: 'c-1',
    created_at: '2026-06-10T10:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
    ...overrides,
  };
}

function claims(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    sub: 'admin-1',
    tenantId: 't-1',
    role: 'tenant_admin',
    actorType: 'user',
    exp: 9999999999,
    ...overrides,
  };
}

describe('approval gating (UX mirror of ADR-013)', () => {
  it('offers approve/reject to a human who did not request the action', () => {
    expect(canDecide(action(), claims())).toBe(true);
  });

  it('never offers approval to the requester of the action', () => {
    expect(canDecide(action({ actor_user_id: 'admin-1', actor_type: 'user' }), claims())).toBe(
      false,
    );
  });

  it('never offers approval to machine sessions', () => {
    expect(canDecide(action(), claims({ actorType: 'voice_agent' }))).toBe(false);
  });

  it('only offers decisions while the action is still requested', () => {
    expect(canDecide(action({ status: 'approved' }), claims())).toBe(false);
    expect(canDecide(action({ status: 'executed' }), claims())).toBe(false);
  });

  it('gated actions execute only from approved; non-gated from requested', () => {
    expect(canExecute(action({ approval_required: true, status: 'requested' }))).toBe(false);
    expect(canExecute(action({ approval_required: true, status: 'approved' }))).toBe(true);
    expect(canExecute(action({ approval_required: false, status: 'requested' }))).toBe(true);
  });

  it('terminal actions offer nothing', () => {
    for (const status of ['rejected', 'executed', 'failed', 'cancelled']) {
      expect(isTerminal(status)).toBe(true);
    }
    expect(isTerminal('requested')).toBe(false);
  });
});
