import type { ApiClient } from './client';
import type {
  AuditEventResponse,
  ControlledActionResponse,
  KnowledgeDocumentResponse,
  ListResponse,
  MetricsOverviewResponse,
  TenantResponse,
  TenantUserResponse,
  VoiceSessionResponse,
} from './types';

/**
 * Typed resource functions for the six ADR-009 contract groups. Thin by
 * design: routing + types only; pagination, filtering and workflow rules
 * live in the API.
 */
// Type alias (not interface) so the implicit index signature lets these
// flow into the client's `params` record.
export type PageQuery = {
  readonly limit?: number;
  readonly cursor?: string;
  readonly status?: string;
};

// --- Tenants -------------------------------------------------------------

export function getTenant(client: ApiClient, tenantId: string): Promise<TenantResponse> {
  return client.get(`/tenants/${tenantId}`);
}

export function updateTenantSettings(
  client: ApiClient,
  tenantId: string,
  settings: Record<string, unknown>,
): Promise<TenantResponse> {
  return client.patch(`/tenants/${tenantId}/settings`, { settings });
}

// --- Users & memberships -------------------------------------------------

export function listUsers(
  client: ApiClient,
  query: PageQuery & { role?: string } = {},
): Promise<ListResponse<TenantUserResponse>> {
  return client.get('/users', query);
}

export function inviteUser(
  client: ApiClient,
  input: { email: string; display_name: string; role: string },
): Promise<TenantUserResponse> {
  return client.post('/users', input);
}

export function updateMembership(
  client: ApiClient,
  membershipId: string,
  input: { role?: string; status?: string },
): Promise<TenantUserResponse> {
  return client.patch(`/memberships/${membershipId}`, input);
}

// --- Knowledge documents -------------------------------------------------

export function listKnowledgeDocuments(
  client: ApiClient,
  query: PageQuery = {},
): Promise<ListResponse<KnowledgeDocumentResponse>> {
  return client.get('/knowledge-documents', query);
}

export function createKnowledgeDocument(
  client: ApiClient,
  input: { title: string; source_uri?: string; content_sha256: string },
): Promise<KnowledgeDocumentResponse> {
  return client.post('/knowledge-documents', input);
}

export function changeKnowledgeDocumentStatus(
  client: ApiClient,
  id: string,
  status: string,
): Promise<KnowledgeDocumentResponse> {
  return client.patch(`/knowledge-documents/${id}/status`, { status });
}

// --- Voice sessions ------------------------------------------------------

export function listVoiceSessions(
  client: ApiClient,
  query: PageQuery = {},
): Promise<ListResponse<VoiceSessionResponse>> {
  return client.get('/voice-sessions', query);
}

export function getVoiceSession(
  client: ApiClient,
  id: string,
): Promise<VoiceSessionResponse> {
  return client.get(`/voice-sessions/${id}`);
}

// --- Controlled actions --------------------------------------------------

export function listActions(
  client: ApiClient,
  query: PageQuery = {},
): Promise<ListResponse<ControlledActionResponse>> {
  return client.get('/actions', query);
}

export function approveAction(client: ApiClient, id: string): Promise<ControlledActionResponse> {
  return client.post(`/actions/${id}/approve`);
}

export function rejectAction(client: ApiClient, id: string): Promise<ControlledActionResponse> {
  return client.post(`/actions/${id}/reject`);
}

export function executeAction(client: ApiClient, id: string): Promise<ControlledActionResponse> {
  return client.post(`/actions/${id}/execute`);
}

// --- Metrics ---------------------------------------------------------------

export function getMetricsOverview(
  client: ApiClient,
  days = 7,
): Promise<MetricsOverviewResponse> {
  return client.get('/metrics/overview', { days });
}

// --- Audit ---------------------------------------------------------------

export function listAuditEvents(
  client: ApiClient,
  query: PageQuery = {},
): Promise<ListResponse<AuditEventResponse>> {
  return client.get('/audit-events', query);
}
