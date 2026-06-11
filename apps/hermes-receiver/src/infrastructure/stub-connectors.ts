import type { ConnectorPort } from '../application/connector.port.js';

/**
 * Stub connectors (ADR-019): execute nothing externally and say so. The
 * `connector_mode: "stub"` stamp is the same honesty rule as the noop
 * dispatcher — simulated work can never read as real work in AURION's
 * evidence. Real calendar/ticketing adapters replace these per integration.
 */
export class StubTicketConnector implements ConnectorPort {
  readonly actionType = 'ticket.create';

  async execute(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      connector_mode: 'stub',
      ticket_id: `STUB-${Math.abs(hashOf(JSON.stringify(payload))).toString(36)}`,
      subject: typeof payload.subject === 'string' ? payload.subject : null,
    };
  }
}

export class StubCalendarConnector implements ConnectorPort {
  readonly actionType = 'calendar.update';

  async execute(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      connector_mode: 'stub',
      event_id: `STUB-${Math.abs(hashOf(JSON.stringify(payload))).toString(36)}`,
      request: typeof payload.request === 'string' ? payload.request : null,
    };
  }
}

export class StubEmailConnector implements ConnectorPort {
  readonly actionType = 'email.send';

  async execute(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      connector_mode: 'stub',
      message_id: `STUB-${Math.abs(hashOf(JSON.stringify(payload))).toString(36)}`,
      subject: typeof payload.subject === 'string' ? payload.subject : null,
    };
  }
}

export class StubWhatsappConnector implements ConnectorPort {
  readonly actionType = 'whatsapp.send';

  async execute(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {
      connector_mode: 'stub',
      message_sid: `STUB-${Math.abs(hashOf(JSON.stringify(payload))).toString(36)}`,
      to: typeof payload.to === 'string' ? payload.to : null,
    };
  }
}

/** Deterministic id derivation so replays in tests are stable. */
function hashOf(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return hash;
}
