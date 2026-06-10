#!/usr/bin/env node
/**
 * AURION SQL-first migration runner (ADR-008, ADR-012).
 *
 * Applies `database/migrations/*.up.sql` in lexicographic order and records
 * each applied file in a `schema_migrations` ledger (filename + SHA-256
 * checksum + timestamp). Already-applied migrations are skipped; a checksum
 * mismatch between the ledger and the file on disk aborts loudly, because a
 * silently edited migration is a corrupted history.
 *
 * Never run from application startup (ADR-008 rule) — this is an explicit,
 * reviewed deployment step:
 *
 *   DATABASE_URL=postgres://... npm run db:migrate
 *   DATABASE_URL=postgres://... npm run db:status
 *
 * Migration files own their transaction boundaries (BEGIN/COMMIT in the SQL),
 * so the runner executes each file as a single batch and records the ledger
 * row afterwards.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'database',
  'migrations',
);

const LEDGER_DDL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum_sha256 TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function listUpMigrations() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith('.up.sql')).sort();
}

async function loadLedger(client) {
  await client.query(LEDGER_DDL);
  const { rows } = await client.query(
    'SELECT filename, checksum_sha256, applied_at FROM schema_migrations ORDER BY filename',
  );
  return new Map(rows.map((row) => [row.filename, row]));
}

async function plan(client) {
  const [files, ledger] = [await listUpMigrations(), await loadLedger(client)];
  const pending = [];

  for (const filename of files) {
    const content = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
    const checksum = sha256(content);
    const applied = ledger.get(filename);

    if (!applied) {
      pending.push({ filename, content, checksum });
      continue;
    }
    if (applied.checksum_sha256 !== checksum) {
      throw new Error(
        `Checksum mismatch for already-applied migration "${filename}". ` +
          'Migrations are immutable once applied; add a new migration instead of editing history.',
      );
    }
  }

  const unknown = [...ledger.keys()].filter((name) => !files.includes(name));
  return { pending, appliedCount: ledger.size, unknown };
}

async function migrate(client) {
  const { pending, unknown } = await plan(client);
  if (unknown.length > 0) {
    throw new Error(
      `Ledger references migrations missing on disk: ${unknown.join(', ')}. Refusing to continue.`,
    );
  }
  if (pending.length === 0) {
    console.log('Database is up to date; nothing to apply.');
    return;
  }

  for (const { filename, content, checksum } of pending) {
    process.stdout.write(`Applying ${filename} ... `);
    await client.query(content);
    await client.query(
      'INSERT INTO schema_migrations (filename, checksum_sha256) VALUES ($1, $2)',
      [filename, checksum],
    );
    console.log('done');
  }
  console.log(`Applied ${pending.length} migration(s).`);
}

async function status(client) {
  const { pending, appliedCount, unknown } = await plan(client);
  console.log(`Applied: ${appliedCount}`);
  console.log(`Pending: ${pending.length}`);
  for (const { filename } of pending) {
    console.log(`  - ${filename}`);
  }
  if (unknown.length > 0) {
    console.log(`WARNING — in ledger but missing on disk: ${unknown.join(', ')}`);
    process.exitCode = 1;
  }
}

async function main() {
  const command = process.argv[2] ?? 'migrate';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  if (!['migrate', 'status'].includes(command)) {
    console.error(`Unknown command "${command}". Use "migrate" or "status".`);
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    // Serialize concurrent deployments: one runner at a time per database.
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['aurion_schema_migrations']);
    if (command === 'migrate') {
      await migrate(client);
    } else {
      await status(client);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
