/**
 * Permission catalog for the MVP (ADR-007, 05_SECURITY/permissions.md).
 *
 * A permission is a fine-grained capability string. Roles never grant authority
 * directly — they map to permissions through the permission matrix, and the
 * policy decision point evaluates the permission against actor, tenant, and
 * approval context. Deny by default.
 */
export const PERMISSIONS = [
  'tenant:settings:update',
  'conversation:read',
  'conversation:review',
  'knowledge:write',
  'tool:execute:calendar.update',
  'tool:execute:ticket.create',
  'audit:read',
  'deployment:approve',
  'billing:change',
  'integration:credentials.update',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Platform-level permissions are NOT tenant-scoped: they concern the AURION
 * platform itself, not a single customer tenant. Everything else requires a
 * `tenant_id` on the target resource.
 */
export const PLATFORM_PERMISSIONS: ReadonlySet<Permission> = new Set(['deployment:approve']);

export function isTenantScoped(permission: Permission): boolean {
  return !PLATFORM_PERMISSIONS.has(permission);
}

/**
 * Sensitive actions must leave audit evidence for both approved and denied
 * decisions (ADR-007 "Audit" rule).
 */
export const SENSITIVE_PERMISSIONS: ReadonlySet<Permission> = new Set([
  'tenant:settings:update',
  'knowledge:write',
  'tool:execute:calendar.update',
  'tool:execute:ticket.create',
  'deployment:approve',
  'billing:change',
  'integration:credentials.update',
]);

export function isSensitive(permission: Permission): boolean {
  return SENSITIVE_PERMISSIONS.has(permission);
}

/**
 * Actions that change money, legal state, production configuration, or customer
 * commitments require explicit human approval before execution (ADR-007).
 * Voice Agent tool execution also requires approval and is handled separately
 * in the policy because it depends on actor type, not just the permission.
 */
export const HUMAN_APPROVAL_REQUIRED: ReadonlySet<Permission> = new Set([
  'deployment:approve',
  'billing:change',
  'integration:credentials.update',
]);

export function requiresHumanApproval(permission: Permission): boolean {
  return HUMAN_APPROVAL_REQUIRED.has(permission);
}

export function isToolExecution(permission: Permission): boolean {
  return permission.startsWith('tool:execute:');
}
