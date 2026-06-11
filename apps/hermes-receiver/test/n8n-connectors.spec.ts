import { describe, expect, it, vi } from 'vitest';

import { ConnectorError } from '../src/application/connector.port.js';
import { loadReceiverConfig } from '../src/config.js';
import { N8nConnector } from '../src/infrastructure/n8n-connector.js';
import { StubEmailConnector, StubWhatsappConnector } from '../src/infrastructure/stub-connectors.js';

// Deliberately low-entropy fixture: must never trip the secret scanner.
const VALID_ENV = { HERMES_RECEIVER_SECRET: 's'.repeat(32) };

const N8N_CONFIG = {
  webhookBase: 'http://n8n:5678/webhook',
  timeoutMs: 5_000,
  secret: 'shared-header-testtest',
};

describe('connector mode configuration (fail closed, ADR-030)', () => {
  it('defaults to stub and loads n8n mode with its webhook base', () => {
    expect(loadReceiverConfig(VALID_ENV).connectorMode).toBe('stub');
    expect(loadReceiverConfig(VALID_ENV).n8n).toBeNull();

    const config = loadReceiverConfig({
      ...VALID_ENV,
      CONNECTOR_MODE: 'n8n',
      N8N_WEBHOOK_BASE: 'http://n8n:5678/webhook/',
    });
    expect(config.connectorMode).toBe('n8n');
    expect(config.n8n?.webhookBase).toBe('http://n8n:5678/webhook');
    expect(config.n8n?.secret).toBeNull();
  });

  it('refuses n8n mode without a webhook base, and unknown modes entirely', () => {
    expect(() => loadReceiverConfig({ ...VALID_ENV, CONNECTOR_MODE: 'n8n' })).toThrow(
      /N8N_WEBHOOK_BASE/,
    );
    expect(() => loadReceiverConfig({ ...VALID_ENV, CONNECTOR_MODE: 'zapier' })).toThrow(
      /CONNECTOR_MODE/,
    );
  });
});

describe('N8nConnector (one workflow per action type, ADR-030)', () => {
  it('posts the payload to the action-typed webhook and stamps the evidence', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'received', event_id: 'cal-123' }), { status: 200 }),
    );
    const connector = new N8nConnector('calendar.update', N8N_CONFIG, fetchMock as unknown as typeof fetch);
    const evidence = await connector.execute({ request: 'mover cita', channel: 'voice' });

    expect(evidence).toMatchObject({
      connector_mode: 'n8n',
      workflow: 'aurion-calendar.update',
      event_id: 'cal-123',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://n8n:5678/webhook/aurion-calendar.update');
    expect(init.headers['x-aurion-secret']).toBe(N8N_CONFIG.secret);
    expect(JSON.parse(init.body)).toEqual({
      action_type: 'calendar.update',
      payload: { request: 'mover cita', channel: 'voice' },
    });
  });

  it('raises ConnectorError on workflow failure — never a fabricated success', async () => {
    const failing = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(
      new N8nConnector('email.send', N8N_CONFIG, failing as unknown as typeof fetch).execute({}),
    ).rejects.toThrow(ConnectorError);

    const unreachable = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      new N8nConnector('email.send', N8N_CONFIG, unreachable as unknown as typeof fetch).execute({}),
    ).rejects.toThrow(/could not be reached/);

    const nonJson = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(
      new N8nConnector('email.send', N8N_CONFIG, nonJson as unknown as typeof fetch).execute({}),
    ).rejects.toThrow(/non-JSON/);
  });

  it('wraps non-object workflow responses instead of losing them', async () => {
    const scalar = vi.fn().mockResolvedValue(new Response(JSON.stringify('ok'), { status: 200 }));
    const evidence = await new N8nConnector(
      'whatsapp.send',
      { ...N8N_CONFIG, secret: null },
      scalar as unknown as typeof fetch,
    ).execute({});
    expect(evidence).toMatchObject({ connector_mode: 'n8n', workflow_response: 'ok' });
    expect(scalar.mock.calls[0][1].headers['x-aurion-secret']).toBeUndefined();
  });
});

describe('new stub connectors stay honest (ADR-019)', () => {
  it('stamp connector_mode stub with deterministic ids', async () => {
    const email = await new StubEmailConnector().execute({ subject: 'hola' });
    expect(email.connector_mode).toBe('stub');
    expect(String(email.message_id)).toMatch(/^STUB-/);

    const whatsapp = await new StubWhatsappConnector().execute({ to: '+34600000000' });
    expect(whatsapp.connector_mode).toBe('stub');
    expect(whatsapp.to).toBe('+34600000000');
  });
});
