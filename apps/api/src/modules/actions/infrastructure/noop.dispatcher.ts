import { Injectable } from '@nestjs/common';

import type {
  ActionDispatcherPort,
  DispatchInput,
  DispatchResult,
} from '../application/action-dispatcher.port';

/**
 * Development/CI dispatcher (ADR-014): performs no external call and stamps
 * every result `dispatch_mode: "noop"` so simulated executions are always
 * distinguishable from real ones in the audit trail. Seeing this stamp in
 * production evidence is an incident signal (key-rotation runbook).
 */
@Injectable()
export class NoopDispatcher implements ActionDispatcherPort {
  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    return {
      ok: true,
      resultPayload: {
        dispatch_mode: 'noop',
        action_id: input.actionId,
        action_type: input.actionType,
        dispatched_at: new Date().toISOString(),
      },
    };
  }
}
