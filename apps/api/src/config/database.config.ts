/**
 * Database configuration, read from the environment once at startup.
 *
 * Fail closed (ADR-012): the API refuses to start without `DATABASE_URL`.
 * There are no insecure defaults. See `.env.example` for the full contract.
 */
export interface DatabaseConfig {
  readonly url: string;
  readonly poolMax: number;
  /** When true, TLS to the database is required and certificates are verified. */
  readonly ssl: boolean;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const url = env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      'DATABASE_URL is required and must be a postgres:// connection string. ' +
        'The API will not start without it (ADR-012).',
    );
  }

  return {
    url,
    poolMax: parsePositiveInt(env.DATABASE_POOL_MAX, 10),
    ssl: env.DATABASE_SSL === 'require',
  };
}
