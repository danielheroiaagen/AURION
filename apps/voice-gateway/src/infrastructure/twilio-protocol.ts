/**
 * Twilio Media Streams frame parsing (ADR-027). Fail-closed on malformed
 * frames; unknown-but-wellformed event types are IGNORED — Twilio adds
 * events over time, and additive tolerance is the same courtesy our own
 * contract extends.
 */
export class TwilioProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwilioProtocolError';
  }
}

export type TwilioEvent =
  | { type: 'connected' }
  | { type: 'start'; streamSid: string; callSid: string; key: string | null }
  | { type: 'media'; payload: string }
  | { type: 'stop' }
  | { type: 'ignored' };

export function parseTwilioEvent(raw: unknown): TwilioEvent {
  let message: unknown = raw;
  if (typeof raw === 'string' || raw instanceof Buffer) {
    try {
      message = JSON.parse(raw.toString());
    } catch {
      throw new TwilioProtocolError('Twilio frames must be JSON objects.');
    }
  }
  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    throw new TwilioProtocolError('Twilio frames must be JSON objects.');
  }
  const frame = message as Record<string, unknown>;

  switch (frame.event) {
    case 'connected':
      return { type: 'connected' };
    case 'start': {
      const start = frame.start as Record<string, unknown> | undefined;
      if (!start || typeof start.streamSid !== 'string' || typeof start.callSid !== 'string') {
        throw new TwilioProtocolError('start requires streamSid and callSid.');
      }
      const params = start.customParameters as Record<string, unknown> | undefined;
      const key = typeof params?.key === 'string' ? params.key : null;
      return { type: 'start', streamSid: start.streamSid, callSid: start.callSid, key };
    }
    case 'media': {
      const media = frame.media as Record<string, unknown> | undefined;
      if (!media || typeof media.payload !== 'string' || media.payload.length === 0) {
        throw new TwilioProtocolError('media requires a base64 payload.');
      }
      return { type: 'media', payload: media.payload };
    }
    case 'stop':
      return { type: 'stop' };
    default:
      if (typeof frame.event !== 'string') {
        throw new TwilioProtocolError('Twilio frames require an event name.');
      }
      return { type: 'ignored' };
  }
}
