/**
 * Response shapes mirrored from the committed contract artifact
 * `32_API_REFERENCE/openapi.json` (ADR-009/ADR-017). snake_case on the wire,
 * ISO-8601 timestamps as strings. When the artifact changes, this file
 * changes in the same PR — the CI drift check keeps the artifact honest.
 */
export interface ListResponse<T> {
  items: T[];
  next_cursor: string | null;
}

export interface TenantResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantUserResponse {
  membership_id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  display_name: string;
  user_status: string;
  role: string;
  membership_status: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocumentResponse {
  id: string;
  tenant_id: string;
  title: string;
  source_uri: string | null;
  content_sha256: string;
  status: string;
  created_by_user_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceSessionResponse {
  id: string;
  tenant_id: string;
  external_session_id: string | null;
  started_by_user_id: string | null;
  status: string;
  transcript_uri: string | null;
  summary: string | null;
  outcome: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ControlledActionResponse {
  id: string;
  tenant_id: string;
  voice_session_id: string | null;
  action_type: string;
  status: string;
  actor_type: string;
  actor_user_id: string | null;
  idempotency_key: string;
  request_payload: Record<string, unknown>;
  result_payload: Record<string, unknown> | null;
  approval_required: boolean;
  approved_by_user_id: string | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEventResponse {
  id: string;
  tenant_id: string;
  actor_type: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: string;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** RFC 9457-style error shape every API error returns (ADR-009). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  code?: string;
  correlation_id?: string;
  message?: string | string[];
}
