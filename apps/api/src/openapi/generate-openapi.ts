import { writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * OpenAPI artifact generator (ADR-009: OpenAPI is the review artifact for
 * request/response shape).
 *
 * Boots the real application module — the same controllers, DTOs and
 * decorators that serve traffic — renders the Swagger document, and writes it
 * to `32_API_REFERENCE/openapi.json`. CI regenerates the file and fails on
 * drift, so the committed artifact is always the code's contract, never a
 * hand-maintained copy.
 *
 * Generation never serves traffic: required fail-closed env vars are filled
 * with generation-only placeholders when absent (no listen(), no DB query —
 * the connection pool is lazy), and the app is closed immediately.
 */
const GENERATION_ENV_DEFAULTS: Record<string, string> = {
  JWT_SECRET: 'openapi-generation-placeholder-secret-32+',
  DATABASE_URL: 'postgres://openapi:openapi@localhost:5432/openapi_generation_only',
  DATA_ENCRYPTION_KEYS: `k1:${Buffer.alloc(32).toString('base64')}`,
  ACTION_DISPATCH_MODE: 'noop',
  AUTH_MODE: 'hs256',
};

const OUTPUT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '32_API_REFERENCE',
  'openapi.json',
);

async function generate(): Promise<void> {
  for (const [key, value] of Object.entries(GENERATION_ENV_DEFAULTS)) {
    process.env[key] = process.env[key] || value;
  }

  // Imported AFTER the env is settled so module factories see a complete,
  // fail-closed-compliant configuration.
  const { AppModule } = await import('../modules/app.module');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('AURION API')
    .setDescription('Voice Agent SaaS Core API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();

  process.stdout.write(`OpenAPI written to ${OUTPUT_PATH}\n`);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
