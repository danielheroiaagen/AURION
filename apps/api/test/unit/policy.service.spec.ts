import type { AuthorizationAuditPort } from '../../src/modules/auth/application/authorization-audit.port';
import { PolicyService } from '../../src/modules/auth/application/policy.service';
import type { AuthenticatedActor } from '../../src/modules/auth/domain/actor';
import type { AuthorizationAuditEvidence } from '../../src/modules/auth/domain/authorization';

class RecordingAudit implements AuthorizationAuditPort {
  readonly records: AuthorizationAuditEvidence[] = [];
  record(evidence: AuthorizationAuditEvidence): void {
    this.records.push(evidence);
  }
}

const tenantAdmin = (tenantId = 'tenant-1'): AuthenticatedActor => ({
  id: 'user-1',
  tenantId,
  type: 'user',
  role: 'tenant_admin',
});

const voiceAgent = (tenantId = 'tenant-1'): AuthenticatedActor => ({
  id: 'agent-1',
  tenantId,
  type: 'voice_agent',
  role: null,
});

describe('PolicyService', () => {
  let audit: RecordingAudit;
  let policy: PolicyService;

  beforeEach(() => {
    audit = new RecordingAudit();
    policy = new PolicyService(audit);
  });

  it('denies when there is no actor', () => {
    const decision = policy.authorize({
      actor: null,
      permission: 'conversation:read',
      resource: { tenantId: 'tenant-1' },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('no_actor');
  });

  it('denies a user with no role (no subject)', () => {
    const decision = policy.authorize({
      actor: { id: 'u', tenantId: 'tenant-1', type: 'user', role: null },
      permission: 'conversation:read',
      resource: { tenantId: 'tenant-1' },
    });
    expect(decision.reason).toBe('no_subject');
  });

  it('denies a tenant-scoped action with no resource tenant', () => {
    const decision = policy.authorize({
      actor: tenantAdmin(),
      permission: 'conversation:read',
      resource: {},
    });
    expect(decision.reason).toBe('missing_tenant');
  });

  it('denies cross-tenant access for non platform owners', () => {
    const decision = policy.authorize({
      actor: tenantAdmin('tenant-1'),
      permission: 'conversation:read',
      resource: { tenantId: 'tenant-2' },
    });
    expect(decision.reason).toBe('cross_tenant');
  });

  it('allows a platform owner to operate across tenants', () => {
    const decision = policy.authorize({
      actor: { id: 'op', tenantId: null, type: 'user', role: 'platform_owner' },
      permission: 'tenant:settings:update',
      resource: { tenantId: 'tenant-9' },
      humanApproval: { approved: true },
    });
    expect(decision.allowed).toBe(true);
  });

  it('denies a permission the role does not grant', () => {
    const decision = policy.authorize({
      actor: { id: 'a', tenantId: 'tenant-1', type: 'user', role: 'auditor' },
      permission: 'knowledge:write',
      resource: { tenantId: 'tenant-1' },
    });
    expect(decision.reason).toBe('role_not_permitted');
  });

  it('allows a granted, non-approval permission within the tenant', () => {
    const decision = policy.authorize({
      actor: tenantAdmin(),
      permission: 'knowledge:write',
      resource: { tenantId: 'tenant-1' },
    });
    expect(decision.allowed).toBe(true);
  });

  it('requires human approval for money/legal/prod actions', () => {
    const denied = policy.authorize({
      actor: { id: 'op', tenantId: null, type: 'user', role: 'platform_owner' },
      permission: 'deployment:approve',
      resource: {},
    });
    expect(denied.reason).toBe('human_approval_required');

    const approved = policy.authorize({
      actor: { id: 'op', tenantId: null, type: 'user', role: 'platform_owner' },
      permission: 'deployment:approve',
      resource: {},
      humanApproval: { approved: true, approverId: 'op' },
    });
    expect(approved.allowed).toBe(true);
  });

  it('requires approval for Voice Agent tool execution', () => {
    const denied = policy.authorize({
      actor: voiceAgent(),
      permission: 'tool:execute:ticket.create',
      resource: { tenantId: 'tenant-1' },
    });
    expect(denied.reason).toBe('human_approval_required');

    const approved = policy.authorize({
      actor: voiceAgent(),
      permission: 'tool:execute:ticket.create',
      resource: { tenantId: 'tenant-1' },
      humanApproval: { approved: true },
    });
    expect(approved.allowed).toBe(true);
  });

  it('lets a Voice Agent read conversation context without approval', () => {
    const decision = policy.authorize({
      actor: voiceAgent(),
      permission: 'conversation:read',
      resource: { tenantId: 'tenant-1' },
    });
    expect(decision.allowed).toBe(true);
  });

  it('emits audit evidence for sensitive decisions (allowed and denied)', () => {
    policy.authorize({
      actor: tenantAdmin(),
      permission: 'knowledge:write',
      resource: { tenantId: 'tenant-1' },
      correlationId: 'corr-1',
    });
    policy.authorize({
      actor: { id: 'a', tenantId: 'tenant-1', type: 'user', role: 'auditor' },
      permission: 'knowledge:write',
      resource: { tenantId: 'tenant-1' },
    });

    expect(audit.records).toHaveLength(2);
    expect(audit.records[0]).toMatchObject({ outcome: 'allowed', permission: 'knowledge:write' });
    expect(audit.records[1]).toMatchObject({ outcome: 'denied', reason: 'role_not_permitted' });
  });

  it('does not audit non-sensitive decisions', () => {
    policy.authorize({
      actor: tenantAdmin(),
      permission: 'conversation:read',
      resource: { tenantId: 'tenant-1' },
    });
    expect(audit.records).toHaveLength(0);
  });
});
