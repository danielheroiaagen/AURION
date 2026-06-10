/**
 * Centralized security configuration, read from the environment once at startup.
 *
 * Fail closed: the API refuses to start without a strong `JWT_SECRET`. There is
 * no insecure default. See `.env.example` for the full contract.
 */
export interface SecurityConfig {
  readonly jwt: {
    readonly secret: string;
    readonly issuer?: string;
    readonly audience?: string;
  };
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

export function loadSecurityConfig(env: NodeJS.ProcessEnv = process.env): SecurityConfig {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is required and must be at least 32 characters. The API will not start without it.',
    );
  }

  return {
    jwt: {
      secret,
      issuer: env.JWT_ISSUER || undefined,
      audience: env.JWT_AUDIENCE || undefined,
    },
    cors: {
      origins: parseList(env.CORS_ORIGINS),
    },
    rateLimit: {
      ttlSeconds: parsePositiveInt(env.RATE_LIMIT_TTL_SECONDS, 60),
      limit: parsePositiveInt(env.RATE_LIMIT_MAX, 100),
    },
  };
}
