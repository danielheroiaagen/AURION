/**
 * Action dispatch configuration (ADR-014), read once at startup.
 *
 * Fail closed: `hermes` mode refuses to start without a valid endpoint and a
 * strong signing secret. `noop` is the explicit development/CI mode — every
 * result it produces is stamped `dispatch_mode: "noop"` so simulated
 * executions can never pass as real evidence.
 */
export type DispatchMode = 'noop' | 'hermes';

export interface HermesDispatchConfig {
  readonly url: string;
  readonly secret: string;
  readonly timeoutMs: number;
}

export interface DispatchConfig {
  readonly mode: DispatchMode;
  readonly hermes: HermesDispatchConfig | null;
}

const LOCAL_HTTP_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadDispatchConfig(env: NodeJS.ProcessEnv = process.env): DispatchConfig {
  const mode = (env.ACTION_DISPATCH_MODE ?? 'noop').trim();

  if (mode === 'noop') {
    return { mode: 'noop', hermes: null };
  }
  if (mode !== 'hermes') {
    throw new Error(`ACTION_DISPATCH_MODE must be "noop" or "hermes", got "${mode}".`);
  }

  const url = env.HERMES_DISPATCH_URL;
  // Private-network escape hatch (ADR-020): compose-internal service DNS is
  // plain http; it must be requested explicitly and never defaults on.
  const allowInsecureHttp = env.HERMES_DISPATCH_ALLOW_INSECURE_HTTP === 'true';
  const acceptable =
    !!url &&
    (url.startsWith('https://') ||
      LOCAL_HTTP_PATTERN.test(url) ||
      (allowInsecureHttp && url.startsWith('http://')));
  if (!acceptable) {
    throw new Error(
      'HERMES_DISPATCH_URL is required in hermes mode and must use https:// (plain http only for localhost, or private networks with HERMES_DISPATCH_ALLOW_INSECURE_HTTP=true).',
    );
  }

  const secret = env.HERMES_DISPATCH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'HERMES_DISPATCH_SECRET is required in hermes mode and must be at least 32 characters.',
    );
  }

  return {
    mode: 'hermes',
    hermes: {
      url,
      secret,
      timeoutMs: parsePositiveInt(env.HERMES_DISPATCH_TIMEOUT_MS, 10_000),
    },
  };
}
