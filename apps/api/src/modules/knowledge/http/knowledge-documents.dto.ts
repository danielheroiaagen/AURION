import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

import type { Page } from '../../../common/pagination/cursor';
import {
  CONTENT_SHA256_PATTERN,
  KNOWLEDGE_DOCUMENT_STATUSES,
  type KnowledgeDocumentStatus,
} from '../domain/knowledge-document';
import type { KnowledgeDocument } from '../application/knowledge-documents.repository.port';

export class CreateKnowledgeDocumentDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Length(1, 500)
  title!: string;

  @ApiPropertyOptional({ description: 'Where the document content lives.', maxLength: 2048 })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @Length(1, 2048)
  source_uri?: string;

  @ApiProperty({ description: 'Lowercase hex SHA-256 of the document content.' })
  @Matches(CONTENT_SHA256_PATTERN, {
    message: 'content_sha256 must be a lowercase hex SHA-256 digest.',
  })
  content_sha256!: string;
}

export class ListKnowledgeDocumentsQueryDto {
  @ApiPropertyOptional({ enum: KNOWLEDGE_DOCUMENT_STATUSES })
  @IsOptional()
  @IsIn(KNOWLEDGE_DOCUMENT_STATUSES)
  status?: KnowledgeDocumentStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Opaque cursor from a previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ChangeKnowledgeDocumentStatusDto {
  @ApiProperty({ enum: KNOWLEDGE_DOCUMENT_STATUSES })
  @IsIn(KNOWLEDGE_DOCUMENT_STATUSES)
  status!: KnowledgeDocumentStatus;
}

/** Stable response shape (ADR-009): snake_case, ISO-8601 timestamps. */
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

export function toKnowledgeDocumentResponse(
  document: KnowledgeDocument,
): KnowledgeDocumentResponse {
  return {
    id: document.id,
    tenant_id: document.tenantId,
    title: document.title,
    source_uri: document.sourceUri,
    content_sha256: document.contentSha256,
    status: document.status,
    created_by_user_id: document.createdByUserId,
    published_at: document.publishedAt?.toISOString() ?? null,
    created_at: document.createdAt.toISOString(),
    updated_at: document.updatedAt.toISOString(),
  };
}

export interface KnowledgeDocumentListResponse {
  items: KnowledgeDocumentResponse[];
  next_cursor: string | null;
}

export function toKnowledgeDocumentListResponse(
  page: Page<KnowledgeDocument>,
): KnowledgeDocumentListResponse {
  return {
    items: page.items.map(toKnowledgeDocumentResponse),
    next_cursor: page.nextCursor,
  };
}
