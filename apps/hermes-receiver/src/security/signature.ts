import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Dispatch authentication (ADR-019, receiver contract): HMAC-SHA256 over
 * `"<timestamp>.<raw body>"`, compared in constant time, with the signed
 * timestamp bounded to a staleness window. Runs BEFORE any JSON parsing —
 * unsigned traffic must not be able to probe parser behavior, so every
 * failure is the same uniform rejection.
 */
export type SignatureFailure = 'invalid_signature' | 'stale_timestamp';

export function verifyDispatchSignature(input: {
  secret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  rawBody: Buffer;
  nowMs: number;
  windowSec: number;
}): SignatureFailure | null {
  const { timestampHeader, signatureHeader } = input;
  if (!timestampHeader || !/^\d{1,16}$/.test(timestampHeader)) {
    return 'invalid_signature';
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return 'invalid_signature';
  }

  const providedHex = signatureHeader.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/.test(providedHex)) {
    return 'invalid_signature';
  }

  const expected = createHmac('sha256', input.secret)
    .update(`${timestampHeader}.`)
    .update(input.rawBody)
    .digest();
  const provided = Buffer.from(providedHex, 'hex');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return 'invalid_signature';
  }

  // Staleness only AFTER authenticity: a forged timestamp must not produce
  // a distinguishable error class.
  const skewMs = Math.abs(input.nowMs - Number(timestampHeader));
  if (skewMs > input.windowSec * 1000) {
    return 'stale_timestamp';
  }
  return null;
}
