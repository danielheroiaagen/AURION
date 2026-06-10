import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { HermesDispatchConfig } from '../../../config/dispatch.config';
import type {
  ActionDispatcherPort,
  DispatchInput,
  DispatchResult,
} from '../application/action-dispatcher.port';

/**
 * HERMES workforce dispatcher (ADR-003, ADR-014).
 *
 * Sends the action as an HMAC-SHA256-signed JSON message and records the 2xx
 * JSON response verbatim as execution evidence. The signature covers
 * `"<timestamp>.<body>"` so captured requests cannot be replayed past the
 * receiver's staleness window.
 *
 * Runtime failures (timeout, non-2xx, malformed response, network error) are
 * returned as `ok: false` results — never thrown — so the use case can
 * persist the `failed` evidence deterministically.
 */
@Injectable()
export class HermesHttpDispatcher implements ActionDispatcherPort {
  constructor(private readonly config: HermesDispatchConfig) {}

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const body = JSON.stringify({
      action_id: input.actionId,
      tenant_id: input.tenantId,
      action_type: input.actionType,
      request_payload: input.requestPayload,
      correlation_id: input.correlationId,
    });
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', this.config.secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-aurion-timestamp': timestamp,
          'x-aurion-signature': `sha256=${signature}`,
          'x-correlation-id': input.correlationId,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          errorCode: 'dispatch_rejected',
          message: `HERMES rejected the dispatch with status ${response.status}.`,
        };
      }

      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        return {
          ok: false,
          errorCode: 'dispatch_invalid_response',
          message: 'HERMES returned a non-JSON response body.',
        };
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          ok: false,
          errorCode: 'dispatch_invalid_response',
          message: 'HERMES returned a JSON body that is not an object.',
        };
      }
      return { ok: true, resultPayload: parsed as Record<string, unknown> };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          ok: false,
          errorCode: 'dispatch_timeout',
          message: `HERMES did not respond within ${this.config.timeoutMs}ms.`,
        };
      }
      return {
        ok: false,
        errorCode: 'dispatch_unreachable',
        message: 'HERMES endpoint could not be reached.',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
