import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';

import type { AurionApiPort, SpeechSynthesisPort } from '../src/application/ports.js';
import { loadGatewayConfig } from '../src/config.js';
import { OpenAiSpeechSynthesizer, SpeechSynthesisError } from '../src/infrastructure/openai-speech.js';
import { ScriptedBrain } from '../src/infrastructure/scripted-brain.js';
import { startWsServer } from '../src/infrastructure/ws-server.js';

const VALID_ENV = {
  AURION_API_URL: 'http://localhost:3000',
  VOICE_AGENT_TOKEN: 'aaa.bbb.ccc',
  VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
};

const TTS_CONFIG = {
  apiUrl: 'https://tts.test/v1',
  // Deliberately low-entropy fixture: must never trip the secret scanner.
  apiKey: 'sk-testtesttest',
  model: 'gpt-4o-mini-tts',
  voice: 'alloy',
  timeoutMs: 5_000,
  maxTextChars: 1_000,
};

describe('TTS configuration (fail closed, ADR-026)', () => {
  it('defaults to off and loads openai mode with defaults', () => {
    expect(loadGatewayConfig(VALID_ENV).ttsMode).toBe('off');
    expect(loadGatewayConfig(VALID_ENV).tts).toBeNull();

    const config = loadGatewayConfig({
      ...VALID_ENV,
      TTS_MODE: 'openai',
      TTS_API_KEY: 'sk-testtesttest',
    });
    expect(config.ttsMode).toBe('openai');
    expect(config.tts?.apiUrl).toBe('https://api.openai.com/v1');
    expect(config.tts?.model).toBe('gpt-4o-mini-tts');
    expect(config.tts?.voice).toBe('alloy');
    expect(config.tts?.maxTextChars).toBe(1_000);
  });

  it('refuses openai mode without a key, and unknown modes entirely', () => {
    expect(() => loadGatewayConfig({ ...VALID_ENV, TTS_MODE: 'openai' })).toThrow(/TTS_API_KEY/);
    expect(() => loadGatewayConfig({ ...VALID_ENV, TTS_MODE: 'elevenlabs' })).toThrow(/TTS_MODE/);
  });
});

describe('OpenAiSpeechSynthesizer (fetch only, no SDK)', () => {
  it('posts the reply text with model and voice, returns mp3 bytes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from('mp3-bytes'), { status: 200 }),
    );
    const synthesizer = new OpenAiSpeechSynthesizer(TTS_CONFIG, fetchMock as unknown as typeof fetch);
    const speech = await synthesizer.synthesize('puedo ayudarte con eso');

    expect(speech.mimeType).toBe('audio/mpeg');
    expect(speech.audio.toString()).toBe('mp3-bytes');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://tts.test/v1/audio/speech');
    expect(init.headers.authorization).toBe(`Bearer ${TTS_CONFIG.apiKey}`);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: 'puedo ayudarte con eso',
      response_format: 'mp3',
    });
  });

  it('caps the synthesized text at maxTextChars — cost is bounded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from('mp3'), { status: 200 }),
    );
    const synthesizer = new OpenAiSpeechSynthesizer(
      { ...TTS_CONFIG, maxTextChars: 10 },
      fetchMock as unknown as typeof fetch,
    );
    await synthesizer.synthesize('x'.repeat(50));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.input).toHaveLength(10);
  });

  it('raises SpeechSynthesisError on upstream failure or empty audio', async () => {
    const failing = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }));
    const broken = new OpenAiSpeechSynthesizer(TTS_CONFIG, failing as unknown as typeof fetch);
    await expect(broken.synthesize('hola')).rejects.toThrow(SpeechSynthesisError);

    const unreachable = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const offline = new OpenAiSpeechSynthesizer(TTS_CONFIG, unreachable as unknown as typeof fetch);
    await expect(offline.synthesize('hola')).rejects.toThrow(/could not be reached/);

    const empty = vi.fn().mockResolvedValue(new Response(Buffer.alloc(0), { status: 200 }));
    const silent = new OpenAiSpeechSynthesizer(TTS_CONFIG, empty as unknown as typeof fetch);
    await expect(silent.synthesize('hola')).rejects.toThrow(/no audio/);
  });
});

// --- WS voice flow ------------------------------------------------------------

function fakeApi(): AurionApiPort {
  return {
    startSession: async () => ({ sessionId: 'vs-1' }),
    listPublishedKnowledge: async () => [],
    requestAction: async () => ({ actionId: 'a-1', status: 'requested', approvalRequired: true }),
    getActionStatus: async () => 'requested',
    closeSession: async () => undefined,
  };
}

const CLIENT_KEY = 'k'.repeat(32);

interface TestClient {
  send(event: Record<string, unknown>): void;
  next(): Promise<Record<string, unknown>>;
  close(): void;
}

function connectClient(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?key=${CLIENT_KEY}`);
    const inbox: Record<string, unknown>[] = [];
    const waiters: Array<(event: Record<string, unknown>) => void> = [];
    socket.on('message', (raw) => {
      const event = JSON.parse(String(raw));
      const waiter = waiters.shift();
      if (waiter) waiter(event);
      else inbox.push(event);
    });
    socket.on('error', reject);
    socket.on('open', () =>
      resolve({
        send: (event) => socket.send(JSON.stringify(event)),
        next: () =>
          new Promise((resolveNext) => {
            const queued = inbox.shift();
            if (queued) resolveNext(queued);
            else waiters.push(resolveNext);
          }),
        close: () => socket.close(),
      }),
    );
  });
}

describe('WS voice flow (ADR-026: text first, voice after, never instead)', () => {
  let server: WebSocketServer | null = null;
  afterEach(() => {
    server?.close();
    server = null;
  });

  function boot(synthesizer: SpeechSynthesisPort | null): number {
    server?.close();
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber: null,
      synthesizer,
      log: () => undefined,
    });
    return (server.address() as { port: number }).port;
  }

  it('voices the reply AFTER the text, with the synthesized bytes', async () => {
    const synthesize = vi.fn(async (text: string) => ({
      audio: Buffer.from(`voz:${text}`),
      mimeType: 'audio/mpeg',
    }));
    const port = boot({ synthesize });
    const client = await connectClient(port);
    client.send({ type: 'session.start' });
    expect(await client.next()).toMatchObject({ type: 'session.started', tts_enabled: true });

    client.send({ type: 'turn.user', text: 'hola' });
    const turn = await client.next();
    expect(turn).toMatchObject({ type: 'turn.agent' });
    const voiced = await client.next();
    expect(voiced).toMatchObject({ type: 'audio.agent', mime_type: 'audio/mpeg' });
    expect(Buffer.from(voiced.audio as string, 'base64').toString()).toBe(
      `voz:${(turn as { text: string }).text}`,
    );
    expect(synthesize).toHaveBeenCalledWith((turn as { text: string }).text);
    client.close();
  });

  it('reports tts_enabled: false and stays text-only without a synthesizer', async () => {
    const port = boot(null);
    const client = await connectClient(port);
    client.send({ type: 'session.start' });
    expect(await client.next()).toMatchObject({ tts_enabled: false });

    client.send({ type: 'turn.user', text: 'hola' });
    expect(await client.next()).toMatchObject({ type: 'turn.agent' });
    // The next server event answers the next request — no audio.agent in between.
    client.send({ type: 'session.end' });
    expect(await client.next()).toMatchObject({ type: 'session.ended' });
    client.close();
  });

  it('a synthesis failure costs the voice, never the answer', async () => {
    const port = boot({
      synthesize: async () => {
        throw new SpeechSynthesisError('provider down');
      },
    });
    const client = await connectClient(port);
    client.send({ type: 'session.start' });
    await client.next();

    client.send({ type: 'turn.user', text: 'hola' });
    expect(await client.next()).toMatchObject({ type: 'turn.agent' });
    expect(await client.next()).toMatchObject({ type: 'error', code: 'tts_failed' });

    // The session survives: the next turn still works.
    client.send({ type: 'turn.user', text: 'sigo aquí' });
    expect(await client.next()).toMatchObject({ type: 'turn.agent' });
    client.close();
  });
});
