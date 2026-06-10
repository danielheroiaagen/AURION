/**
 * Receiver configuration (ADR-019), read once at startup. Fail closed:
 * there is no unsigned mode — the shared dispatch secret is mandatory.
 */
export interface ReceiverConfig {
  readonly port: number;
  /** Must equal the API's HERMES_DISPATCH_SECRET (pairwise symmetric key). */
  readonly secret: string;
  /** Accepted clock drift for the signed timestamp, seconds (default 300). */
  readonly stalenessWindowSec: number;
  /** LRU capacity of the in-memory action_id dedupe store. */
  readonly dedupeCapacity: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadReceiverConfig(env: NodeJS.ProcessEnv = process.env): ReceiverConfig {
  const secret = env.HERMES_RECEIVER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'HERMES_RECEIVER_SECRET is required and must be at least 32 characters (ADR-019). There is no unsigned mode.',
    );
  }
  return {
    port: parsePositiveInt(env.PORT, 8090),
    secret,
    stalenessWindowSec: parsePositiveInt(env.HERMES_STALENESS_WINDOW_SEC, 300),
    dedupeCapacity: parsePositiveInt(env.HERMES_DEDUPE_CAPACITY, 10_000),
  };
}
