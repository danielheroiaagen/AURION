import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed TwiML endpoint helpers (ADR-028). The TwiML carries the gateway
 * client key, so it is handed ONLY to requests proving they come from
 * Twilio: X-Twilio-Signature = base64(HMAC-SHA1(authToken, url + sorted
 * form params)), compared in constant time.
 */
export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((name) => name + params[name])
      .join('');
  const expected = createHmac('sha1', authToken).update(payload).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, 'base64');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Over-capacity answer (ADR-034): Twilio's own TTS speaks the busy
 * message — the call never touches our billed providers. */
export function buildBusyTwiml(lang: string): string {
  const spanish = lang.toLowerCase().startsWith('es');
  const message = spanish
    ? 'En este momento todas nuestras líneas están ocupadas. Por favor, inténtalo de nuevo en unos minutos.'
    : 'All of our lines are busy right now. Please try again in a few minutes.';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<Say language="${escapeXml(spanish ? 'es-ES' : lang || 'en-US')}">${escapeXml(message)}</Say>`,
    '<Hangup/>',
    '</Response>',
  ].join('');
}

/**
 * The ADR-027 connect snippet, generated from current config.
 * When `callerNumber` is provided (Twilio's `From` field, URL-decoded before
 * calling here), it is forwarded as a `caller` custom parameter so the bridge
 * can store the originating number at session creation (Phase-30, ADR-039).
 */
export function buildTwiml(
  publicUrl: string,
  clientKey: string,
  callerNumber?: string,
): string {
  const streamUrl = `${publicUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/twilio`;
  const callerParam = callerNumber
    ? `<Parameter name="caller" value="${escapeXml(callerNumber)}" />`
    : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response><Connect>',
    `<Stream url="${escapeXml(streamUrl)}">`,
    `<Parameter name="key" value="${escapeXml(clientKey)}" />`,
    callerParam,
    '</Stream>',
    '</Connect></Response>',
  ].join('');
}
