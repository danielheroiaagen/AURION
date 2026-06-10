import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';

import type { AurionApiPort, TranscriptionPort } from '../src/application/ports.js';
import { loadGatewayConfig } from '../src/config.js';
import { OpenAiTranscriber, TranscriptionError } from '../src/infrastructure/openai-transcriber.js';
import { parseClientEvent, ProtocolError } from '../src/infrastructure/protocol.js';
import { ScriptedBrain } from '../src/infrastructure/scripted-brain.js';
import { startWsServer } from '../src/infrastructure/ws-server.js';

const VALID_ENV = {
  AURION_API_URL: 'http://localhost:3000',
  VOICE_AGENT_TOKEN: 'aaa.bbb.ccc',
  VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
};

const STT_CONFIG = {
  apiUrl: 'https://stt.test/v1',
  // Deliberately low-entropy fixture: must never trip the secret scanner.
  apiKey: 'sk-testtesttest',
  model: 'gpt-4o-mini-transcribe',
  timeoutMs: 5_000,
  maxAudioBytes: 2_000_000,
};

describe('STT configuration (fail closed, ADR-025)', () => {
  it('defaults to off and loads openai mode with defaults', () => {
    expect(loadGatewayConfig(VALID_ENV).sttMode).toBe('off');
    expect(loadGatewayConfig(VALID_ENV).stt).toBeNull();

    const config = loadGatewayConfig({
      ...VALID_ENV,
      STT_MODE: 'openai',
      STT_API_KEY: 'sk-testtesttest',
    });
    expect(config.sttMode).toBe('openai');
    expect(config.stt?.apiUrl).toBe('https://api.openai.com/v1');
    expect(config.stt?.model).toBe('gpt-4o-mini-transcribe');
    expect(config.stt?.maxAudioBytes).toBe(2_000_000);
  });

  it('refuses openai mode without a key, and unknown modes entirely', () => {
    expect(() => loadGatewayConfig({ ...VALID_ENV, STT_MODE: 'openai' })).toThrow(/STT_API_KEY/);
    expect(() => loadGatewayConfig({ ...VALID_ENV, STT_MODE: 'whisper-local' })).toThrow(
      /STT_MODE/,
    );
  });
});

describe('audio.utterance protocol parsing', () => {
  it('parses a documented utterance', () => {
    expect(
      parseClientEvent(
        JSON.stringify({ type: 'audio.utterance', audio: 'QQ==', mime_type: 'audio/webm', lang: 'es-ES' }),
      ),
    ).toEqual({ type: 'audio.utterance', audio: 'QQ==', mime_type: 'audio/webm', lang: 'es-ES' });
  });

  it('rejects missing audio and non-audio mime types', () => {
    expect(() =>
      parseClientEvent(JSON.stringify({ type: 'audio.utterance', mime_type: 'audio/webm' })),
    ).toThrow(ProtocolError);
    expect(() =>
      parseClientEvent(JSON.stringify({ type: 'audio.utterance', audio: 'QQ==', mime_type: 'text/html' })),
    ).toThrow(/audio\/\*/);
  });
});

describe('OpenAiTranscriber (fetch only, no SDK)', () => {
  it('posts multipart audio with the key and returns the trimmed text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: '  hola mundo  ' }), { status: 200 }),
    );
    const transcriber = new OpenAiTranscriber(STT_CONFIG, fetchMock as unknown as typeof fetch);
    const text = await transcriber.transcribe({
      audio: Buffer.from('audio-bytes'),
      mimeType: 'audio/webm',
      lang: 'es-ES',
    });
    expect(text).toBe('hola mundo');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://stt.test/v1/audio/transcriptions');
    expect(init.headers.authorization).toBe(`Bearer ${STT_CONFIG.apiKey}`);
    const form = init.body as FormData;
    expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
    // BCP 47 → ISO-639-1: the endpoint wants "es", not "es-ES".
    expect(form.get('language')).toBe('es');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });

  it('raises TranscriptionError on upstream failure — never fabricates text', async () => {
    const failing = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }));
    const transcriber = new OpenAiTranscriber(STT_CONFIG, failing as unknown as typeof fetch);
    await expect(
      transcriber.transcribe({ audio: Buffer.from('x'), mimeType: 'audio/webm' }),
    ).rejects.toThrow(TranscriptionError);

    const unreachable = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const offline = new OpenAiTranscriber(STT_CONFIG, unreachable as unknown as typeof fetch);
    await expect(
      offline.transcribe({ audio: Buffer.from('x'), mimeType: 'audio/webm' }),
    ).rejects.toThrow(/could not be reached/);
  });

  it('returns empty text when the provider heard nothing', async () => {
    const empty = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const transcriber = new OpenAiTranscriber(STT_CONFIG, empty as unknown as typeof fetch);
    await expect(
      transcriber.transcribe({ audio: Buffer.from('x'), mimeType: 'audio/webm' }),
    ).resolves.toBe('');
  });
});

// --- WS audio flow ------------------------------------------------------------

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

describe('WS audio flow (ADR-025: capture changes, authority does not)', () => {
  let server: WebSocketServer | null = null;
  afterEach(() => {
    server?.close();
    server = null;
  });

  function boot(transcriber: TranscriptionPort | null): number {
    server?.close();
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber,
      log: () => undefined,
    });
    return (server.address() as { port: number }).port;
  }

  it('transcribes an utterance, echoes the transcript, and runs the SAME turn path', async () => {
    const port = boot({ transcribe: async () => 'tengo un problema con mi pedido' });
    const client = await connectClient(port);
    client.send({ type: 'session.start' });
    const started = await client.next();
    expect(started).toMatchObject({ type: 'session.started', stt_enabled: true });

    client.send({
      type: 'audio.utterance',
      audio: Buffer.from('fake-opus').toString('base64'),
      mime_type: 'audio/webm',
      lang: 'es-ES',
    });
    expect(await client.next()).toEqual({
      type: 'audio.transcript',
      text: 'tengo un problema con mi pedido',
    });
    // ScriptedBrain maps the transcript to a ticket intent → approval-gated action.
    expect(await client.next()).toMatchObject({ type: 'action.requested', approval_pending: true });
    expect(await client.next()).toMatchObject({ type: 'turn.agent' });
    client.close();
  });

  it('echoes an empty transcript without running a turn', async () => {
    const port = boot({ transcribe: async () => '' });
    const client = await connectClient(port);
    client.send({ type: 'session.start' });
    await client.next();
    client.send({ type: 'audio.utterance', audio: 'QQ==', mime_type: 'audio/webm' });
    expect(await client.next()).toEqual({ type: 'audio.transcript', text: '' });

    // The session is still alive and a typed turn still works.
    client.send({ type: 'turn.user', text: 'hola' });
    expect(await client.next()).toMatchObject({ type: 'turn.agent' });
    client.close();
  });

  it('answers stt_disabled when no transcriber is configured, stt_failed on provider outage', async () => {
    const port = boot(null);
    const client = await connectClient(port);
    client.send({ type: 'session.start' });
    const started = await client.next();
    expect(started).toMatchObject({ stt_enabled: false });
    client.send({ type: 'audio.utterance', audio: 'QQ==', mime_type: 'audio/webm' });
    expect(await client.next()).toMatchObject({ type: 'error', code: 'stt_disabled' });
    client.close();

    const failingPort = boot({
      transcribe: async () => {
        throw new TranscriptionError('upstream down');
      },
    });
    const failingClient = await connectClient(failingPort);
    failingClient.send({ type: 'session.start' });
    await failingClient.next();
    failingClient.send({ type: 'audio.utterance', audio: 'QQ==', mime_type: 'audio/webm' });
    expect(await failingClient.next()).toMatchObject({ type: 'error', code: 'stt_failed' });
    failingClient.close();
  });

  it('caps utterance size with a stable error code', async () => {
    const transcribe = vi.fn(async () => 'never called');
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber: { transcribe },
      maxAudioBytes: 8,
      log: () => undefined,
    });
    const port = (server.address() as { port: number }).port;
    const client = await connectClient(port);
    client.send({ type: 'session.start' });
    await client.next();
    client.send({
      type: 'audio.utterance',
      audio: Buffer.alloc(64, 1).toString('base64'),
      mime_type: 'audio/webm',
    });
    expect(await client.next()).toMatchObject({ type: 'error', code: 'audio_too_large' });
    expect(transcribe).not.toHaveBeenCalled();
    client.close();
  });
});
