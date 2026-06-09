import type { AuthorizationAuditEvidence } from '../domain/authorization';

/**
 * Outbound port for recording authorization evidence (hexagonal boundary).
 * The application depends on this interface, never on a concrete sink. The MVP
 * binds it to a structured logger; a database-backed adapter that writes to the
 * `audit_events` table lands with the persistence layer (ADR-008).
 */
export interface AuthorizationAuditPort {
  record(evidence: AuthorizationAuditEvidence): void;
}

/** DI token for the authorization audit port. */
export const AUTHORIZATION_AUDIT_PORT = Symbol('AUTHORIZATION_AUDIT_PORT');
