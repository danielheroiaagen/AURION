import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CorrelationId } from '../../../common/correlation/correlation-id.decorator';
import { requireActorTenant } from '../../../common/http/actor-tenant';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedActor } from '../../auth/domain/actor';
import { ControlledActionsService } from '../application/controlled-actions.service';
import {
  ListActionsQueryDto,
  RequestActionDto,
  requireIdempotencyKey,
  toControlledActionListResponse,
  toControlledActionResponse,
  type ControlledActionListResponse,
  type ControlledActionResponse,
} from './controlled-actions.dto';

/**
 * Controlled actions (ADR-009 `/api/v1/actions`, ADR-013).
 *
 * The workflow routes (request/approve/reject/execute) carry no static
 * `@RequirePermission`: the tool permission depends on the action type in the
 * request, so the use case invokes the policy decision point directly. The
 * global guards still enforce authentication on every route; reads use the
 * static `action:read` permission.
 */
@ApiTags('actions')
@ApiBearerAuth()
@Controller('actions')
export class ControlledActionsController {
  constructor(private readonly actions: ControlledActionsService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Request a controlled action (idempotent: same key + payload replays as 200).',
  })
  async request(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() body: RequestActionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CorrelationId() correlationId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlledActionResponse> {
    const { action, created } = await this.actions.request(actor, requireActorTenant(actor), {
      actionType: body.action_type,
      voiceSessionId: body.voice_session_id ?? null,
      requestPayload: body.request_payload,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      correlationId,
    });
    response.status(created ? 201 : 200);
    return toControlledActionResponse(action);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a requested action (human actors only, never the requester).' })
  async approve(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<ControlledActionResponse> {
    return toControlledActionResponse(
      await this.actions.approve(actor, requireActorTenant(actor), id, correlationId),
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a requested action (human actors only, never the requester).' })
  async reject(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<ControlledActionResponse> {
    return toControlledActionResponse(
      await this.actions.reject(actor, requireActorTenant(actor), id, correlationId),
    );
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Execute an action: the policy re-authorizes with the recorded approval and the result is produced by the dispatcher (ADR-014), never by the client.',
  })
  async execute(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<ControlledActionResponse> {
    return toControlledActionResponse(
      await this.actions.execute(actor, requireActorTenant(actor), id, correlationId),
    );
  }

  @Get()
  @RequirePermission('action:read')
  @ApiOperation({ summary: 'List controlled actions (cursor pagination).' })
  async list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListActionsQueryDto,
  ): Promise<ControlledActionListResponse> {
    const page = await this.actions.list({
      tenantId: requireActorTenant(actor),
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return toControlledActionListResponse(page);
  }

  @Get(':id')
  @RequirePermission('action:read')
  @ApiOperation({ summary: 'Read a controlled action (payloads decrypted for authorized readers).' })
  async getById(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ControlledActionResponse> {
    return toControlledActionResponse(
      await this.actions.getById(requireActorTenant(actor), id),
    );
  }
}
