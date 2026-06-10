import { createServer, type Server } from 'node:http';

import type { ConnectorRegistry } from '../application/connector.port.js';
import {
  DedupeStore,
  handleDispatch,
  parseDispatchMessage,
} from '../application/dispatch-handler.js';
import type { ReceiverConfig } from '../config.js';
import { verifyDispatchSignature } from '../security/signature.js';

const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Inbound dispatch edge (ADR-019). Order of checks is the contract:
 * method/size gates → signature over RAW bytes → staleness → JSON parse →
 * shape → dedupe → connector. Authentication failures are uniform 401s.
 */
export function startReceiver(
  config: ReceiverConfig,
  registry: ConnectorRegistry,
  options: { log?: (message: string) => void; now?: () => number } = {},
): Server {
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  const now = options.now ?? Date.now;
  const dedupe = new DedupeStore(config.dedupeCapacity);

  const server = createServer((request, response) => {
    const reply = (status: number, body: Record<string, unknown>): void => {
      const payload = JSON.stringify(body);
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(payload);
    };

    if (request.method !== 'POST' || request.url !== '/dispatch') {
      reply(404, { code: 'not_found', message: 'POST /dispatch is the only route.' });
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;

    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        reply(413, { code: 'payload_too_large', message: 'Body exceeds 1 MB.' });
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      if (aborted) {
        return;
      }
      void (async () => {
        const rawBody = Buffer.concat(chunks);

        const failure = verifyDispatchSignature({
          secret: config.secret,
          timestampHeader: header(request.headers['x-aurion-timestamp']),
          signatureHeader: header(request.headers['x-aurion-signature']),
          rawBody,
          nowMs: now(),
          windowSec: config.stalenessWindowSec,
        });
        if (failure) {
          reply(401, { code: failure, message: 'Dispatch rejected.' });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody.toString('utf8'));
        } catch {
          reply(400, { code: 'bad_payload', message: 'Body must be JSON.' });
          return;
        }
        const message = parseDispatchMessage(parsed);
        if (!message) {
          reply(400, { code: 'bad_payload', message: 'Dispatch message shape is invalid.' });
          return;
        }

        const result = await handleDispatch(message, registry, dedupe);
        reply(result.status, result.body);
      })().catch((error: unknown) => {
        log(`unhandled dispatch error: ${error instanceof Error ? error.message : String(error)}`);
        reply(500, { code: 'internal_error', message: 'Unexpected receiver failure.' });
      });
    });
  });

  server.listen(config.port, () => log(`hermes receiver listening on :${config.port}/dispatch`));
  return server;
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
