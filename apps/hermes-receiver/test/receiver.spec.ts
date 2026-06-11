import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConnectorRegistry, type ConnectorPort } from '../src/application/connector.port.js';
import {
  DedupeStore,
  handleDispatch,
  parseDispatchMessage,
} from '../src/application/dispatch-handler.js';
import { loadReceiverConfig } from '../src/config.js';
import { startReceiver } from '../src/infrastructure/http-server.js';
import {
  StubCalendarConnector,
  StubTicketConnector,
} from '../src/infrastructure/stub-connectors.js';
import { verifyDispatchSignature } from '../src/security/signature.js';

const SECRET = 's'.repeat(32);
const NOW = 1_765_000_000_000;

function sign(body: string, timestamp: string, secret = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

function dispatchMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action_id: 'a-1',
    tenant_id: 't-1',
    action_type: 'ticket.create',
    request_payload: { subject: 'help' },
    correlation_id: 'c-1',
    ...overrides,
  };
}

describe('loadReceiverConfig (fail closed)', () => {
  it('requires a strong shared secret; no unsigned mode exists', () => {
    expect(() => loadReceiverConfig({})).toThrow(/HERMES_RECEIVER_SECRET/);
    expect(() => loadReceiverConfig({ HERMES_RECEIVER_SECRET: 'short' })).toThrow(/32/);
    const config = loadReceiverConfig({ HERMES_RECEIVER_SECRET: SECRET });
    expect(config.stalenessWindowSec).toBe(300);
    expect(config.dedupeCapacity).toBe(10_000);
  });
});

describe('verifyDispatchSignature', () => {
  const body = Buffer.from(JSON.stringify(dispatchMessage()));
  const timestamp = String(NOW);

  function verify(overrides: Partial<Parameters<typeof verifyDispatchSignature>[0]> = {}) {
    return verifyDispatchSignature({
      secret: SECRET,
      timestampHeader: timestamp,
      signatureHeader: sign(body.toString(), timestamp),
      rawBody: body,
      nowMs: NOW,
      windowSec: 300,
      ...overrides,
    });
  }

  it('accepts a correctly signed, fresh dispatch', () => {
    expect(verify()).toBeNull();
  });

  it('rejects missing/malformed/forged signatures uniformly', () => {
    expect(verify({ signatureHeader: undefined })).toBe('invalid_signature');
    expect(verify({ timestampHeader: undefined })).toBe('invalid_signature');
    expect(verify({ signatureHeader: 'sha256=deadbeef' })).toBe('invalid_signature');
    expect(verify({ signatureHeader: sign(body.toString(), timestamp, 'x'.repeat(32)) })).toBe(
      'invalid_signature',
    );
    // Tampered body invalidates the signature.
    expect(verify({ rawBody: Buffer.from('{"tampered":true}') })).toBe('invalid_signature');
  });

  it('rejects stale timestamps in both directions, but only when authentic', () => {
    const oldTs = String(NOW - 301_000);
    expect(
      verify({ timestampHeader: oldTs, signatureHeader: sign(body.toString(), oldTs) }),
    ).toBe('stale_timestamp');
    const futureTs = String(NOW + 301_000);
    expect(
      verify({ timestampHeader: futureTs, signatureHeader: sign(body.toString(), futureTs) }),
    ).toBe('stale_timestamp');
    // A stale timestamp with a BAD signature reads as invalid, not stale:
    // forged traffic learns nothing about the window.
    expect(verify({ timestampHeader: oldTs })).toBe('invalid_signature');
  });
});

describe('dispatch handler (dedupe + connectors)', () => {
  it('executes at most once per action_id and replays the original evidence', async () => {
    const registry = new ConnectorRegistry();
    let executions = 0;
    const counting: ConnectorPort = {
      actionType: 'ticket.create',
      execute: async () => ({ connector_mode: 'stub', ticket_id: `T-${++executions}` }),
    };
    registry.register(counting);
    const dedupe = new DedupeStore(10);

    const message = parseDispatchMessage(dispatchMessage());
    expect(message).not.toBeNull();
    const first = await handleDispatch(message!, registry, dedupe);
    const replay = await handleDispatch(message!, registry, dedupe);

    expect(executions).toBe(1);
    expect(first.status).toBe(200);
    expect((replay.body as Record<string, unknown>).ticket_id).toBe('T-1');
    expect((replay.body as Record<string, unknown>).replayed).toBe(true);
  });

  it('rejects unknown action types explicitly (never silent success)', async () => {
    const result = await handleDispatch(
      parseDispatchMessage(dispatchMessage({ action_type: 'rm.rf' }))!,
      new ConnectorRegistry(),
      new DedupeStore(10),
    );
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ code: 'unknown_action_type' });
  });

  it('maps connector failures to a stable code and does not poison dedupe', async () => {
    const registry = new ConnectorRegistry();
    let attempt = 0;
    registry.register({
      actionType: 'ticket.create',
      execute: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('downstream down');
        }
        return { connector_mode: 'stub', ticket_id: 'T-ok' };
      },
    });
    const dedupe = new DedupeStore(10);
    const message = parseDispatchMessage(dispatchMessage())!;

    const failed = await handleDispatch(message, registry, dedupe);
    expect(failed.status).toBe(502);
    expect(failed.body).toMatchObject({ code: 'connector_failed' });

    // A failure was never recorded as evidence; a later dispatch may succeed.
    const retried = await handleDispatch(message, registry, dedupe);
    expect(retried.status).toBe(200);
  });

  it('rejects malformed message shapes', () => {
    expect(parseDispatchMessage(null)).toBeNull();
    expect(parseDispatchMessage([1])).toBeNull();
    expect(parseDispatchMessage(dispatchMessage({ action_id: '' }))).toBeNull();
    expect(parseDispatchMessage(dispatchMessage({ request_payload: 'nope' }))).toBeNull();
  });
});

describe('stub connectors are honest about simulation', () => {
  it('stamps connector_mode: stub on every result', async () => {
    const ticket = await new StubTicketConnector().execute({ subject: 'help' });
    expect(ticket.connector_mode).toBe('stub');
    const calendar = await new StubCalendarConnector().execute({ request: 'move' });
    expect(calendar.connector_mode).toBe('stub');
  });
});

describe('HTTP receiver end to end (real signed requests)', () => {
  let baseUrl: string;
  let close: () => void;

  beforeAll(async () => {
    const registry = new ConnectorRegistry();
    registry.register(new StubTicketConnector());
    const server = startReceiver(
      {
        port: 0,
        secret: SECRET,
        stalenessWindowSec: 300,
        dedupeCapacity: 100,
        connectorMode: 'stub',
        n8n: null,
      },
      registry,
      { log: () => undefined },
    );
    await new Promise<void>((resolve) => server.on('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });

  afterAll(() => close());

  function post(body: string, headers: Record<string, string>): Promise<Response> {
    return fetch(`${baseUrl}/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    });
  }

  it('accepts a signed dispatch and returns stub evidence', async () => {
    const body = JSON.stringify(dispatchMessage({ action_id: 'e2e-1' }));
    const timestamp = String(Date.now());
    const response = await post(body, {
      'x-aurion-timestamp': timestamp,
      'x-aurion-signature': sign(body, timestamp),
      'x-correlation-id': 'c-1',
    });
    expect(response.status).toBe(200);
    const evidence = (await response.json()) as Record<string, unknown>;
    expect(evidence.connector_mode).toBe('stub');
    expect(evidence.action_id).toBe('e2e-1');
  });

  it('rejects unsigned and tampered requests with uniform 401s before parsing', async () => {
    const body = JSON.stringify(dispatchMessage({ action_id: 'e2e-2' }));
    const unsigned = await post(body, {});
    expect(unsigned.status).toBe(401);

    const timestamp = String(Date.now());
    const tampered = await post(`${body} `, {
      'x-aurion-timestamp': timestamp,
      'x-aurion-signature': sign(body, timestamp),
    });
    expect(tampered.status).toBe(401);

    // Even NON-JSON garbage gets the same 401 when unsigned: the parser is
    // unreachable without authentication.
    const garbage = await post('not json at all', {});
    expect(garbage.status).toBe(401);
  });

  it('404s every other route', async () => {
    const response = await fetch(`${baseUrl}/anything`, { method: 'GET' });
    expect(response.status).toBe(404);
  });
});
