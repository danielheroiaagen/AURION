/**
 * Tenant-scoped roles for AURION (ADR-007).
 *
 * These values mirror the `role` CHECK constraint in the MVP schema migration
 * and the permission matrix in `05_SECURITY/permissions.md`. Roles describe the
 * authority a human actor holds *within a single tenant* (except the platform
 * owner, which is an internal AURION operator).
 */
export const ROLES = [
  'platform_owner',
  'tenant_admin',
  'supervisor',
  'human_agent',
  'developer_integrator',
  'auditor',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
