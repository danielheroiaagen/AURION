import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { requireActorTenant } from '../../../common/http/actor-tenant';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { KnowledgeDocumentsService } from '../application/knowledge-documents.service';
import {
  ChangeKnowledgeDocumentStatusDto,
  CreateKnowledgeDocumentDto,
  ListKnowledgeDocumentsQueryDto,
  toKnowledgeDocumentListResponse,
  toKnowledgeDocumentResponse,
  type KnowledgeDocumentListResponse,
  type KnowledgeDocumentResponse,
} from './knowledge-documents.dto';

/**
 * Knowledge base (ADR-009 `/api/v1/knowledge-documents`).
 *
 * Flat tenant-scoped routes: the effective tenant is always the verified
 * actor's tenant; RLS underneath makes any other outcome structurally
 * impossible. Controllers adapt HTTP only — lifecycle rules live in the
 * application service.
 */
@ApiTags('knowledge-documents')
@ApiBearerAuth()
@Controller('knowledge-documents')
export class KnowledgeDocumentsController {
  constructor(private readonly documents: KnowledgeDocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('knowledge:write')
  @ApiOperation({ summary: 'Register a knowledge document (starts in draft).' })
  async create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() body: CreateKnowledgeDocumentDto,
  ): Promise<KnowledgeDocumentResponse> {
    const document = await this.documents.create(actor, {
      tenantId: requireActorTenant(actor),
      title: body.title,
      sourceUri: body.source_uri ?? null,
      contentSha256: body.content_sha256,
    });
    return toKnowledgeDocumentResponse(document);
  }

  @Get()
  @RequirePermission('knowledge:read')
  @ApiOperation({ summary: 'List knowledge documents (cursor pagination).' })
  async list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListKnowledgeDocumentsQueryDto,
  ): Promise<KnowledgeDocumentListResponse> {
    const page = await this.documents.list({
      tenantId: requireActorTenant(actor),
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return toKnowledgeDocumentListResponse(page);
  }

  @Get(':id')
  @RequirePermission('knowledge:read')
  @ApiOperation({ summary: 'Read a knowledge document.' })
  async getById(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<KnowledgeDocumentResponse> {
    return toKnowledgeDocumentResponse(
      await this.documents.getById(requireActorTenant(actor), id),
    );
  }

  @Patch(':id/status')
  @RequirePermission('knowledge:write')
  @ApiOperation({ summary: 'Move a document through its lifecycle.' })
  async changeStatus(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeKnowledgeDocumentStatusDto,
  ): Promise<KnowledgeDocumentResponse> {
    return toKnowledgeDocumentResponse(
      await this.documents.changeStatus(requireActorTenant(actor), id, body.status),
    );
  }
}
