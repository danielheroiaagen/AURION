import type { ColumnType, Generated, JSONColumnType } from 'kysely';

/**
 * Typed mirror of the SQL migrations under `database/migrations` (ADR-008,
 * ADR-012). The database is the source of truth: when a migration changes a
 * table, this file follows it — never the other way around.
 *
 * Conventions:
 *  - `Generated<T>` for plain columns the database defaults (ids, status).
 *  - `ColumnType<select, insert, update>` where mutation is restricted.
 *  - Timestamps select as `Date` via node-postgres.
 */

/**
 * Database-defaulted timestamp: selects as `Date`, optional on insert. Used
 * directly (not wrapped in `Generated`) because nesting `ColumnType` inside
 * `Generated` prevents Kysely from unwrapping the select type.
 */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export type TenantStatus = 'active' | 'suspended' | 'deleted';

export interface TenantsTable {
  id: Generated<string>;
  slug: string;
  name: string;
  status: Generated<TenantStatus>;
  settings: JSONColumnType<Record<string, unknown>>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type UserStatus = 'active' | 'invited' | 'disabled';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  display_name: string;
  status: Generated<UserStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type MembershipRole =
  | 'platform_owner'
  | 'tenant_admin'
  | 'supervisor'
  | 'human_agent'
  | 'developer_integrator'
  | 'auditor';

export interface TenantMembershipsTable {
  id: Generated<string>;
  tenant_id: string;
  user_id: string;
  role: MembershipRole;
  status: Generated<UserStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type KnowledgeDocumentStatus = 'draft' | 'review' | 'published' | 'archived';

export interface KnowledgeDocumentsTable {
  id: Generated<string>;
  tenant_id: string;
  title: string;
  source_uri: string | null;
  content_sha256: string;
  status: Generated<KnowledgeDocumentStatus>;
  created_by_user_id: string | null;
  published_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type VoiceSessionStatus = 'started' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface VoiceSessionsTable {
  id: Generated<string>;
  tenant_id: string;
  external_session_id: string | null;
  started_by_user_id: string | null;
  status: Generated<VoiceSessionStatus>;
  transcript_uri: string | null;
  /** Encrypted at the application layer before storage (ADR-011/ADR-012). */
  summary: string | null;
  outcome: string | null;
  started_at: Timestamp;
  ended_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type ControlledActionStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'
  | 'cancelled';

export type DbActorType = 'user' | 'voice_agent' | 'system';

export interface ControlledActionsTable {
  id: Generated<string>;
  tenant_id: string;
  voice_session_id: string | null;
  action_type: string;
  status: Generated<ControlledActionStatus>;
  actor_type: DbActorType;
  actor_user_id: string | null;
  idempotency_key: string;
  request_payload: JSONColumnType<Record<string, unknown>>;
  result_payload: JSONColumnType<Record<string, unknown>> | null;
  approval_required: Generated<boolean>;
  approved_by_user_id: string | null;
  correlation_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type AuditOutcome = 'allowed' | 'denied' | 'succeeded' | 'failed';

/** Append-only at the database layer (migration 0002): insert/select only. */
export interface AuditEventsTable {
  id: Generated<string>;
  tenant_id: string;
  actor_type: DbActorType;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: AuditOutcome;
  correlation_id: string;
  metadata: JSONColumnType<Record<string, unknown>>;
  created_at: Timestamp;
}

export type TurnSpeaker = 'caller' | 'agent';

/**
 * Per-turn transcript retained for call QA (migration 0003, ADR-039).
 * Append-only at the database layer (same guard as audit_events); `text` is
 * encrypted at the application layer before storage (ADR-011/ADR-012).
 */
export interface VoiceSessionTurnsTable {
  id: Generated<string>;
  tenant_id: string;
  voice_session_id: string;
  turn_index: number;
  speaker: TurnSpeaker;
  text: string;
  created_at: Timestamp;
}

export interface Database {
  tenants: TenantsTable;
  users: UsersTable;
  tenant_memberships: TenantMembershipsTable;
  knowledge_documents: KnowledgeDocumentsTable;
  voice_sessions: VoiceSessionsTable;
  controlled_actions: ControlledActionsTable;
  audit_events: AuditEventsTable;
  voice_session_turns: VoiceSessionTurnsTable;
}
