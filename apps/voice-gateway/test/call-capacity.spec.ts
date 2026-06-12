import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import type { AurionApiPort } from '../src/application/ports.js';
import { loadGatewayConfig } from '../src/config.js';
import { CallCapacity } from '../src/infrastructure/call-capacity.js';
import { ScriptedBrain } from '../src/infrastructure/scripted-brain.js';
import { buildBusyTwiml } from '../src/infrastructure/twiml.js';
import { startWsServer } from '../src/infrastructure/ws-server.js';

describe('CallCapacity (cost guard, ADR-034)', () => {
  it('caps simultaneous calls and frees a slot on hangup', () => {
    const capacity = new CallCapacity(2, 100);
    expect(capacity.hasRoom()).toBe(true);
    capacity.begin();
    capacity.begin();
    expect(capacity.hasRoom()).toBe(false);
    capacity.end();
    expect(capacity.hasRoom()).toBe(true);
  });

  it('caps calls per day and rolls over at midnight', () => {
    let day = '2026-06-11T10:00:00Z';
    const capacity = new CallCapacity(10, 2, () => new Date(day));
    capacity.begin();
    capacity.end();
    capacity.begin();
    capacity.end();
    expect(capacity.hasRoom()).toBe(false);
    day = '2026-06-12T00:05:00Z';
    expect(capacity.hasRoom()).toBe(true);
  });

  it('speaks the busy message in the channel language via Twilio TTS', () => {
    const es = buildBusyTwiml('es-ES');
    expect(es).toContain('<Say language="es-ES">');
    expect(es).toContain('ocupadas');
    expect(es).toContain('<Hangup/>');
    expect(buildBusyTwiml('en-US')).toContain('busy right now');
  });

  it('validates the env settings', () => {
    const config = loadGatewayConfig({
      AURION_API_URL: 'http://localhost:3000',
      VOICE_AGENT_TOKEN: 'a.b.c',
      VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
      STT_MODE: 'openai',
      STT_API_KEY: 'sk-testtesttest',
      TTS_MODE: 'openai',
      TTS_API_KEY: 'sk-testtesttest',
      TELEPHONY_MODE: 'twilio',
      TWILIO_AUTH_TOKEN: 'twilio-token-testtesttest',
      TELEPHONY_PUBLIC_URL: 'https://aurion.test',
      TELEPHONY_MAX_CONCURRENT: '2',
      TELEPHONY_MAX_CALLS_PER_DAY: '50',
    });
    expect(config.telephony?.maxConcurrentCalls).toBe(2);
    expect(config.telephony?.maxCallsPerDay).toBe(50);
  });
});

describe('the TwiML door refuses over-capacity calls (ADR-034)', () => {
  const CLIENT_KEY = 'k'.repeat(32);
  let server: Server | null = null;
  afterEach(() => {
    server?.close();
    server = null;
  });

  function fakeApi(): AurionApiPort {
    return {
      startSession: async () => ({ sessionId: 'vs-1' }),
      listPublishedKnowledge: async () => [],
      requestAction: async () => ({ actionId: 'a-1', status: 'requested', approvalRequired: true }),
      getActionStatus: async () => 'requested',
      closeSession: async () => undefined,
    };
  }

  it('connects the first caller, answers busy to the one over the cap, then recovers', async () => {
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber: null,
      synthesizer: null,
      twilio: {
        clientKeys: [CLIENT_KEY],
        api: fakeApi(),
        brain: new ScriptedBrain(),
        transcriber: { open: async () => ({ push: () => undefined, close: () => undefined }) },
        synthesizer: {
          synthesize: async () => ({ audio: Buffer.alloc(960), mimeType: 'audio/pcm' }),
        },
        telephony: {
          greeting: 'Hola.',
          lang: 'es-ES',
          silenceMs: 600,
          twilioAuthToken: 'twilio-token-testtesttest',
          publicUrl: 'https://aurion.test',
          sttModel: '',
          maxConcurrentCalls: 1,
          maxCallsPerDay: 200,
          backchannelMs: 0,
          routes: [],
        },
      },
      log: () => undefined,
    });
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;

    const signedTwiml = async (): Promise<string> => {
      const params = { CallSid: 'CAx' };
      const payload = `https://aurion.test/twiml${'CallSid'}${'CAx'}`;
      const signature = createHmac('sha1', 'twilio-token-testtesttest')
        .update(payload)
        .digest('base64');
      const response = await fetch(`${base}/twiml`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': signature,
        },
        body: new URLSearchParams(params).toString(),
      });
      return response.text();
    };

    // Room available → connect TwiML.
    expect(await signedTwiml()).toContain('<Stream');

    // One live call fills the only slot.
    const socket = new WebSocket(`ws://127.0.0.1:${port}/twilio`);
    await new Promise((resolve) => socket.on('open', resolve));
    socket.send(
      JSON.stringify({
        event: 'start',
        start: { streamSid: 'MZ1', callSid: 'CA1', customParameters: { key: CLIENT_KEY } },
      }),
    );
    await vi.waitFor(async () => expect(await signedTwiml()).toContain('ocupadas'));

    // Hangup frees the slot.
    socket.close();
    await vi.waitFor(async () => expect(await signedTwiml()).toContain('<Stream'));
  });
});
