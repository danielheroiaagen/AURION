import type { MembershipRole, UserStatus } from '../../../database/database.schema';

/**
 * Membership rules for the users administration surface (ADR-009 group
 * `/api/v1/users` + `/api/v1/memberships`).
 *
 * `platform_owner` is the internal AURION operator role: it is provisioned
 * out of band and is never assignable through the tenant-facing API. Granting
 * it here would let a tenant admin mint a cross-tenant operator.
 */
export const ASSIGNABLE_ROLES = [
  'tenant_admin',
  'supervisor',
  'human_agent',
  'developer_integrator',
  'auditor',
] as const satisfies readonly MembershipRole[];

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * Statuses an admin may set on a membership. `invited` is the entry state
 * stamped by the invite flow, never set by hand.
 */
export const MEMBERSHIP_SETTABLE_STATUSES = ['active', 'disabled'] as const satisfies readonly UserStatus[];

export type MembershipSettableStatus = (typeof MEMBERSHIP_SETTABLE_STATUSES)[number];
