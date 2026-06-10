/**
 * Knowledge document lifecycle (ADR-009 "Knowledge base" group).
 *
 * Mirrors the `knowledge_documents.status` CHECK constraint and adds the
 * business rule the database cannot express: which transitions are legal.
 *
 *   draft → review → published → archived
 *            ↓ (reject)
 *          draft
 */
export const KNOWLEDGE_DOCUMENT_STATUSES = ['draft', 'review', 'published', 'archived'] as const;

export type KnowledgeDocumentStatus = (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<KnowledgeDocumentStatus, readonly KnowledgeDocumentStatus[]> = {
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['archived'],
  archived: [],
};

export function canTransition(
  from: KnowledgeDocumentStatus,
  to: KnowledgeDocumentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Lowercase hex SHA-256 — the content integrity marker stored at rest. */
export const CONTENT_SHA256_PATTERN = /^[0-9a-f]{64}$/;
