/**
 * Centralized security configuration, read from the environment once at startup.
 *
 * Fail closed: the API refuses to start without a complete authentication
 * configuration for the selected `AUTH_MODE` (ADR-007, ADR-016). There are no
 * insecure defaults. See `.env.example` for the full contract.
 */
export interface HsAuthConfig {
  readonly mode: 'hs256';
  readonly jwt: {
    readonly secret: string;
    readonly issuer?: string;
    readonly audience?: string;
  };
}

export interface JwksAuthConfig {
  readonly mode: 'jwks';
  readonly jwks: {
    readonly url: string;
    /** Required in jwks mode: an unpinned third-party issuer is an account-takeover primitive. */
    readonly issuer: string;
    readonly audience: string;
    readonly cacheTtlSec: number;
  };
}

export type AuthModeConfig = HsAuthConfig | JwksAuthConfig;

export interface SecurityConfig {
  readonly auth: AuthModeConfig;
  readonly cors: {
    /** Explicit origin allowlist. Empty array means "no cross-origin allowed". */
    readonly origins: string[];
  };
  readonly rateLimit: {
    readonly ttlSeconds: number;
    readonly limit: number;
  };
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadAuthConfig(env: NodeJS.ProcessEnv): AuthModeConfig {
  const mode = (env.AUTH_MODE ?? 'hs256').trim();

  if (mode === 'hs256') {
    const secret = env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET is required and must be at least 32 characters in hs256 mode. The API will not start without it.',
      );
    }
    return {
      mode: 'hs256',
      jwt: {
        secret,
        issuer: env.JWT_ISSUER || undefined,
        audience: env.JWT_AUDIENCE || undefined,
      },
    };
  }

  if (mode !== 'jwks') {
    throw new Error(`AUTH_MODE must be "hs256" or "jwks", got "${mode}".`);
  }

  const url = env.AUTH_JWKS_URL;
  if (!url || !url.startsWith('https://')) {
    throw new Error('AUTH_JWKS_URL is required in jwks mode and must use https://.');
  }
  const issuer = env.JWT_ISSUER;
  const audience = env.JWT_AUDIENCE;
  if (!issuer || !audience) {
    throw new Error(
      'JWT_ISSUER and JWT_AUDIENCE are required in jwks mode: tokens from an external IdP must be pinned to one issuer and one audience (ADR-016).',
    );
  }

  return {
    mode: 'jwks',
    jwks: {
      url,
      issuer,
      audience,
      cacheTtlSec: parsePositiveInt(env.AUTH_JWKS_CACHE_SECONDS, 600),
    },
  };
}

export function loadSecurityConfig(env: NodeJS.ProcessEnv = process.env): SecurityConfig {
  return {
    auth: loadAuthConfig(env),
    cors: {
      origins: parseList(env.CORS_ORIGINS),
    },
    rateLimit: {
      ttlSeconds: parsePositiveInt(env.RATE_LIMIT_TTL_SECONDS, 60),
      limit: parsePositiveInt(env.RATE_LIMIT_MAX, 100),
    },
  };
}
