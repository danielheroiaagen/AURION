import type { Role } from './roles';

/**
 * Machine and human actor types, mirroring the `actor_type` CHECK constraint in
 * the schema. Authorization treats them differently: only `user` actors carry a
 * tenant role; `voice_agent` and `system` actors are governed by narrower,
 * type-specific rules (ADR-007).
 */
export const ACTOR_TYPES = ['user', 'voice_agent', 'system'] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

export function isActorType(value: unknown): value is ActorType {
  return typeof value === 'string' && (ACTOR_TYPES as readonly string[]).includes(value);
}

/**
 * Normalized identity extracted from a verified JWT. This is the only identity
 * shape the application layer trusts — controllers and guards must not invent
 * authority beyond it.
 */
export interface AuthenticatedActor {
  /** Subject claim: stable user or machine-actor id. */
  readonly id: string;
  /** Tenant the actor is acting within. Null only for global platform operators. */
  readonly tenantId: string | null;
  readonly type: ActorType;
  /** Tenant role for `user` actors; null for machine actors. */
  readonly role: Role | null;
}

/**
 * The policy "subject" used to look up permissions: a human role, or a machine
 * actor type. This keeps the permission matrix expressible as a single map.
 */
export type PolicySubject = Role | 'voice_agent' | 'system';

export function subjectOf(actor: AuthenticatedActor): PolicySubject | null {
  if (actor.type === 'user') {
    return actor.role;
  }
  return actor.type;
}
