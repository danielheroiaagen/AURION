import type { PolicySubject } from './actor';
import type { Permission } from './permissions';
import { PERMISSIONS } from './permissions';

/**
 * MVP permission matrix (ADR-007, 05_SECURITY/permissions.md).
 *
 * Design rules applied here:
 *  - Deny by default: a subject only holds the permissions listed below.
 *  - "Parcial" cells from the documented matrix are NOT granted at this coarse
 *    RBAC layer; partial scoping needs a dedicated ADR, so granting it now would
 *    over-authorize. They are intentionally omitted.
 *  - `billing:change` and `integration:credentials.update` are listed in
 *    ADR-007 as sensitive actions without a matrix column. They are mapped here
 *    conservatively (owner/admin for billing; owner/admin/integrator for
 *    integration credentials) and always require human approval.
 *  - Granting a permission here does not bypass tenant checks or human approval;
 *    those are enforced by the policy decision point.
 */
const MATRIX: Record<PolicySubject, ReadonlySet<Permission>> = {
  // Internal AURION operator: full platform authority.
  platform_owner: new Set<Permission>([...PERMISSIONS]),

  tenant_admin: new Set<Permission>([
    'tenant:read',
    'tenant:settings:update',
    'conversation:read',
    'conversation:review',
    'conversation:write',
    'knowledge:read',
    'knowledge:write',
    'action:read',
    'tool:execute:calendar.update',
    'tool:execute:ticket.create',
    'audit:read',
    'billing:change',
    'integration:credentials.update',
  ]),

  supervisor: new Set<Permission>([
    'tenant:read',
    'conversation:read',
    'conversation:review',
    'knowledge:read',
    'action:read',
    'tool:execute:ticket.create',
    'audit:read',
  ]),

  human_agent: new Set<Permission>([
    'conversation:read',
    'knowledge:read',
    'tool:execute:ticket.create',
  ]),

  // Integrations specialist: integration credentials only at this layer.
  developer_integrator: new Set<Permission>(['integration:credentials.update']),

  auditor: new Set<Permission>([
    'tenant:read',
    'conversation:read',
    'conversation:review',
    'knowledge:read',
    'action:read',
    'audit:read',
  ]),

  // Machine actor: narrow read + tool execution, always gated by policy/approval.
  // `knowledge:read` is the agent's core capability: answering from the
  // tenant's published knowledge base. `conversation:write` lets the runtime
  // create and advance its own sessions; `action:read` lets it poll the
  // approval status of actions it requested.
  voice_agent: new Set<Permission>([
    'conversation:read',
    'conversation:write',
    'knowledge:read',
    'action:read',
    'tool:execute:calendar.update',
    'tool:execute:ticket.create',
  ]),

  // Internal system jobs: session ingestion/cleanup only (ADR-013).
  system: new Set<Permission>(['conversation:write']),
};

export function roleGrants(subject: PolicySubject, permission: Permission): boolean {
  return MATRIX[subject]?.has(permission) ?? false;
}
