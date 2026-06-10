/**
 * WebSocket event protocol (27_VOICE_IVR/websocket-event-contracts.md).
 * Parsing is fail-closed: anything not matching the contract raises
 * `ProtocolError` and is answered with an `error` event — the socket stays
 * open, the conversation record stays consistent.
 */
export class ProtocolError extends Error {
  constructor(
    readonly code: 'bad_message',
    message: string,
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export type ClientEvent =
  | { type: 'session.start'; external_session_id?: string }
  | { type: 'turn.user'; text: string }
  | { type: 'action.poll'; action_id: string }
  | { type: 'session.end'; outcome?: string };

export type ServerEvent =
  | { type: 'session.started'; session_id: string }
  | { type: 'turn.agent'; text: string }
  | {
      type: 'action.requested';
      action_id: string;
      action_type: string;
      approval_pending: true;
    }
  | { type: 'action.update'; action_id: string; status: string }
  | { type: 'session.ended'; session_id: string; status: string }
  | { type: 'error'; code: string; message: string };

export function parseClientEvent(raw: unknown): ClientEvent {
  let message: unknown = raw;
  if (typeof raw === 'string' || raw instanceof Buffer) {
    try {
      message = JSON.parse(raw.toString());
    } catch {
      throw new ProtocolError('bad_message', 'Frames must be JSON objects.');
    }
  }
  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    throw new ProtocolError('bad_message', 'Frames must be JSON objects.');
  }
  const event = message as Record<string, unknown>;

  switch (event.type) {
    case 'session.start': {
      if (event.external_session_id !== undefined && typeof event.external_session_id !== 'string') {
        throw new ProtocolError('bad_message', 'external_session_id must be a string.');
      }
      return { type: 'session.start', external_session_id: event.external_session_id as string | undefined };
    }
    case 'turn.user': {
      if (typeof event.text !== 'string' || event.text.trim().length === 0) {
        throw new ProtocolError('bad_message', 'turn.user requires non-empty text.');
      }
      return { type: 'turn.user', text: event.text };
    }
    case 'action.poll': {
      if (typeof event.action_id !== 'string' || event.action_id.length === 0) {
        throw new ProtocolError('bad_message', 'action.poll requires action_id.');
      }
      return { type: 'action.poll', action_id: event.action_id };
    }
    case 'session.end': {
      if (event.outcome !== undefined && typeof event.outcome !== 'string') {
        throw new ProtocolError('bad_message', 'outcome must be a string.');
      }
      return { type: 'session.end', outcome: event.outcome as string | undefined };
    }
    default:
      throw new ProtocolError('bad_message', `Unknown event type "${String(event.type)}".`);
  }
}

export function serializeServerEvent(event: ServerEvent): string {
  return JSON.stringify(event);
}
