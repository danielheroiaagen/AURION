/**
 * Client-side mirror of the gateway WebSocket event contract
 * (27_VOICE_IVR/websocket-event-contracts.md, ADR-018). The widget never
 * invents event shapes — this file IS the contract as the caller sees it.
 */
export type ClientEvent =
  | { type: 'session.start'; external_session_id?: string }
  | { type: 'turn.user'; text: string }
  | { type: 'audio.utterance'; audio: string; mime_type: string; lang?: string }
  | { type: 'action.poll'; action_id: string }
  | { type: 'session.end'; outcome?: string };

export type ServerEvent =
  | { type: 'session.started'; session_id: string; stt_enabled?: boolean }
  | { type: 'turn.agent'; text: string }
  | { type: 'audio.transcript'; text: string }
  | { type: 'action.requested'; action_id: string; action_type: string; approval_pending: true }
  | { type: 'action.update'; action_id: string; status: string }
  | { type: 'session.ended'; session_id: string; status: string }
  | { type: 'error'; code: string; message: string };

const SERVER_EVENT_TYPES = new Set([
  'session.started',
  'turn.agent',
  'audio.transcript',
  'action.requested',
  'action.update',
  'session.ended',
  'error',
]);

export function parseServerEvent(raw: string): ServerEvent | null {
  try {
    const event = JSON.parse(raw) as { type?: unknown };
    if (typeof event.type === 'string' && SERVER_EVENT_TYPES.has(event.type)) {
      return event as ServerEvent;
    }
    return null;
  } catch {
    return null;
  }
}
