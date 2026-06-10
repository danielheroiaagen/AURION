import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import { loadDatabaseConfig } from '../config/database.config';
import type { Database } from './database.schema';
import { KYSELY } from './database.tokens';
import { TenantScopedDb } from './tenant-scope';

/**
 * Global database module (ADR-008, ADR-012).
 *
 * Owns the node-postgres pool and the Kysely instance for the whole API and
 * releases them on shutdown so in-flight transactions drain cleanly. The pool
 * connects lazily — startup validates configuration (fail closed), not
 * connectivity; readiness is the deployment platform's probe concern.
 */
@Global()
@Module({
  providers: [
    {
      provide: KYSELY,
      useFactory: (): Kysely<Database> => {
        const config = loadDatabaseConfig();
        const pool = new Pool({
          connectionString: config.url,
          max: config.poolMax,
          ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
        });
        return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
      },
    },
    TenantScopedDb,
  ],
  exports: [KYSELY, TenantScopedDb],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async onApplicationShutdown(): Promise<void> {
    // Destroys the dialect's pool; safe to call once during graceful shutdown.
    await this.db.destroy();
  }
}
