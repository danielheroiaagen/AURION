import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { requireActorTenant } from '../../../common/http/actor-tenant';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { VoiceSessionsService } from '../application/voice-sessions.service';
import {
  ChangeVoiceSessionStatusDto,
  ListVoiceSessionsQueryDto,
  PatchAiSummaryDto,
  StartVoiceSessionDto,
  toVoiceSessionListResponse,
  toVoiceSessionResponse,
  type VoiceSessionListResponse,
  type VoiceSessionResponse,
} from './voice-sessions.dto';

/**
 * Voice sessions (ADR-009 `/api/v1/voice-sessions`, ADR-013).
 *
 * Flat tenant-scoped routes: the effective tenant is always the verified
 * actor's tenant. Controllers adapt HTTP only — lifecycle rules live in the
 * application service; encryption at rest lives in the repository adapter.
 */
@ApiTags('voice-sessions')
@ApiBearerAuth()
@Controller('voice-sessions')
export class VoiceSessionsController {
  constructor(private readonly sessions: VoiceSessionsService) {}

  @Post()
  @RequirePermission('conversation:write')
  @ApiOperation({
    summary: 'Start a voice session (idempotent on external_session_id: replay returns 200).',
  })
  async start(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() body: StartVoiceSessionDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VoiceSessionResponse> {
    const { session, created } = await this.sessions.start(
      actor,
      requireActorTenant(actor),
      body.external_session_id ?? null,
      body.caller_number ?? null,
    );
    response.status(created ? 201 : 200);
    return toVoiceSessionResponse(session);
  }

  @Get()
  @RequirePermission('conversation:read')
  @ApiOperation({ summary: 'List voice sessions (cursor pagination).' })
  async list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListVoiceSessionsQueryDto,
  ): Promise<VoiceSessionListResponse> {
    const page = await this.sessions.list({
      tenantId: requireActorTenant(actor),
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return toVoiceSessionListResponse(page);
  }

  @Get(':id')
  @RequirePermission('conversation:read')
  @ApiOperation({ summary: 'Read a voice session (summary decrypted for authorized readers).' })
  async getById(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VoiceSessionResponse> {
    return toVoiceSessionResponse(await this.sessions.getById(requireActorTenant(actor), id));
  }

  @Patch(':id/status')
  @RequirePermission('conversation:write')
  @ApiOperation({
    summary: 'Advance the session lifecycle; closing transitions accept outcome fields.',
  })
  async changeStatus(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeVoiceSessionStatusDto,
  ): Promise<VoiceSessionResponse> {
    return toVoiceSessionResponse(
      await this.sessions.changeStatus(requireActorTenant(actor), id, body.status, {
        summary: body.summary,
        outcome: body.outcome,
        transcriptUri: body.transcript_uri,
      }),
    );
  }

  @Patch(':id/ai-summary')
  @RequirePermission('conversation:write')
  @ApiOperation({
    summary:
      'Write AI-generated summary and insights to a terminal session (idempotent, Phase-30).',
  })
  async patchAiSummary(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PatchAiSummaryDto,
  ): Promise<VoiceSessionResponse> {
    return toVoiceSessionResponse(
      await this.sessions.patchAiSummary(requireActorTenant(actor), id, {
        aiSummary: body.ai_summary,
        aiInsights: body.ai_insights,
      }),
    );
  }
}
