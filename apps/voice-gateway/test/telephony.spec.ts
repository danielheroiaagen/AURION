import type { Server } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';

import type {
  AgentBrainPort,
  AurionApiPort,
  SpeechSynthesisPort,
  StreamingTranscriptionPort,
  UtteranceStreamHandlers,
} from '../src/application/ports.js';
import { loadGatewayConfig } from '../src/config.js';
import { linearToUlaw, pcm16ToUlaw8k, ulawFrames, ulawToLinear } from '../src/infrastructure/audio.js';
import { OpenAiRealtimeTranscriber } from '../src/infrastructure/realtime-transcriber.js';
import { ScriptedBrain } from '../src/infrastructure/scripted-brain.js';
import { parseTwilioEvent, TwilioProtocolError } from '../src/infrastructure/twilio-protocol.js';
import { startWsServer } from '../src/infrastructure/ws-server.js';

const VALID_ENV = {
  AURION_API_URL: 'http://localhost:3000',
  VOICE_AGENT_TOKEN: 'aaa.bbb.ccc',
  VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
};

// Deliberately low-entropy fixtures: must never trip the secret scanner.
const VOICE_ENV = {
  ...VALID_ENV,
  STT_MODE: 'openai',
  STT_API_KEY: 'sk-testtesttest',
  TTS_MODE: 'openai',
  TTS_API_KEY: 'sk-testtesttest',
};

const PHONE_ENV = {
  ...VOICE_ENV,
  TELEPHONY_MODE: 'twilio',
  TWILIO_AUTH_TOKEN: 'twilio-token-testtesttest',
  TELEPHONY_PUBLIC_URL: 'https://aurion.test',
};

describe('telephony configuration (fail closed, ADR-027/ADR-028)', () => {
  it('defaults to off and loads twilio mode with defaults', () => {
    expect(loadGatewayConfig(VALID_ENV).telephonyMode).toBe('off');
    expect(loadGatewayConfig(VALID_ENV).telephony).toBeNull();

    const config = loadGatewayConfig(PHONE_ENV);
    expect(config.telephonyMode).toBe('twilio');
    expect(config.telephony?.lang).toBe('es-ES');
    expect(config.telephony?.silenceMs).toBe(600);
    expect(config.telephony?.backchannelMs).toBe(1500);
    expect(config.telephony?.greeting.length).toBeGreaterThan(0);
    expect(config.telephony?.publicUrl).toBe('https://aurion.test');
  });

  it('refuses to answer phones without BOTH ears and voice', () => {
    expect(() =>
      loadGatewayConfig({ ...VALID_ENV, TELEPHONY_MODE: 'twilio' }),
    ).toThrow(/STT_MODE=openai and TTS_MODE=openai/);
    expect(() =>
      loadGatewayConfig({
        ...VALID_ENV,
        TELEPHONY_MODE: 'twilio',
        STT_MODE: 'openai',
        STT_API_KEY: 'sk-testtesttest',
      }),
    ).toThrow(/TTS_MODE/);
    expect(() => loadGatewayConfig({ ...VOICE_ENV, TELEPHONY_MODE: 'sip' })).toThrow(
      /TELEPHONY_MODE/,
    );
  });

  it('answers phones with the heygen voice too (ADR-029: any speaking mode qualifies)', () => {
    const config = loadGatewayConfig({
      ...PHONE_ENV,
      TTS_MODE: 'heygen',
      TTS_API_KEY: 'hg-testtesttest',
      TTS_VOICE: 'voice-id-testtest',
    });
    expect(config.telephonyMode).toBe('twilio');
    expect(config.ttsMode).toBe('heygen');
  });

  it('refuses twilio mode without the signature token and a pinned https origin (ADR-028)', () => {
    expect(() =>
      loadGatewayConfig({ ...PHONE_ENV, TWILIO_AUTH_TOKEN: undefined as never }),
    ).toThrow(/TWILIO_AUTH_TOKEN/);
    expect(() =>
      loadGatewayConfig({ ...PHONE_ENV, TELEPHONY_PUBLIC_URL: 'http://insecure.test' }),
    ).toThrow(/TELEPHONY_PUBLIC_URL/);
  });
});

describe('μ-law transcode (dependency-free wire audio)', () => {
  it('encodes silence to 0xFF and survives a round trip within quantization error', () => {
    expect(linearToUlaw(0)).toBe(0xff);
    for (const sample of [0, 128, -128, 1000, -1000, 8000, -8000, 30000, -30000]) {
      const decoded = ulawToLinear(linearToUlaw(sample));
      // μ-law is logarithmic: tolerance scales with magnitude.
      expect(Math.abs(decoded - sample)).toBeLessThanOrEqual(Math.max(16, Math.abs(sample) / 16));
    }
  });

  it('downsamples 24 kHz PCM16 to one μ-law byte per 3 samples', () => {
    const pcm = Buffer.alloc(960); // 480 samples of silence
    const ulaw = pcm16ToUlaw8k(pcm);
    expect(ulaw.length).toBe(160);
    expect(ulaw.every((byte) => byte === 0xff)).toBe(true);
  });

  it('frames wire audio in 160-byte (20 ms) chunks', () => {
    const frames = ulawFrames(Buffer.alloc(400, 0xff));
    expect(frames.map((frame) => frame.length)).toEqual([160, 160, 80]);
  });
});

describe('Twilio Media Streams frame parsing (fail closed)', () => {
  it('parses the documented lifecycle frames', () => {
    expect(parseTwilioEvent(JSON.stringify({ event: 'connected' }))).toEqual({
      type: 'connected',
    });
    expect(
      parseTwilioEvent(
        JSON.stringify({
          event: 'start',
          start: {
            streamSid: 'MZ1',
            callSid: 'CA1',
            customParameters: { key: 'k'.repeat(32) },
          },
        }),
      ),
    ).toEqual({ type: 'start', streamSid: 'MZ1', callSid: 'CA1', key: 'k'.repeat(32) });
    expect(parseTwilioEvent(JSON.stringify({ event: 'media', media: { payload: 'QQ==' } }))).toEqual(
      { type: 'media', payload: 'QQ==' },
    );
    expect(parseTwilioEvent(JSON.stringify({ event: 'stop' }))).toEqual({ type: 'stop' });
  });

  it('ignores unknown-but-wellformed events, rejects malformed frames', () => {
    expect(parseTwilioEvent(JSON.stringify({ event: 'mark', mark: { name: 'x' } }))).toEqual({
      type: 'ignored',
    });
    expect(() => parseTwilioEvent('not json')).toThrow(TwilioProtocolError);
    expect(() => parseTwilioEvent(JSON.stringify({ event: 'start', start: {} }))).toThrow(
      /streamSid/,
    );
    expect(() => parseTwilioEvent(JSON.stringify({ event: 'media', media: {} }))).toThrow(
      /payload/,
    );
  });
});

// --- Realtime transcription adapter ------------------------------------------

const STT_CONFIG = {
  apiUrl: 'http://127.0.0.1', // patched per test with the fake provider's port
  apiKey: 'sk-testtesttest',
  model: 'gpt-4o-transcribe',
  timeoutMs: 2_000,
  maxAudioBytes: 2_000_000,
};

interface FakeProvider {
  port: number;
  received: Record<string, unknown>[];
  send(event: Record<string, unknown>): void;
  authorization: string | undefined;
  close(): void;
}

function startFakeProvider(): Promise<FakeProvider> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0 });
    const received: Record<string, unknown>[] = [];
    let client: WebSocket | null = null;
    let authorization: string | undefined;
    const provider: FakeProvider = {
      port: 0,
      received,
      send: (event) => client?.send(JSON.stringify(event)),
      get authorization() {
        return authorization;
      },
      close: () => wss.close(),
    };
    wss.on('connection', (socket, request) => {
      client = socket;
      authorization = request.headers.authorization;
      socket.on('message', (raw) => received.push(JSON.parse(String(raw))));
    });
    wss.on('listening', () => {
      provider.port = (wss.address() as { port: number }).port;
      resolve(provider);
    });
  });
}

describe('OpenAiRealtimeTranscriber (ws client, audio/pcmu, ADR-027)', () => {
  it('opens a transcription session, forwards μ-law as-is, and surfaces VAD turns', async () => {
    const provider = await startFakeProvider();
    const transcriber = new OpenAiRealtimeTranscriber(
      { ...STT_CONFIG, apiUrl: `http://127.0.0.1:${provider.port}` },
      600,
    );
    const onUtterance = vi.fn();
    const onSpeechStarted = vi.fn();
    const stream = await transcriber.open(
      { onUtterance, onSpeechStarted, onError: vi.fn() },
      'es-ES',
    );

    await vi.waitFor(() => expect(provider.received.length).toBeGreaterThan(0));
    expect(provider.authorization).toBe(`Bearer ${STT_CONFIG.apiKey}`);
    const sessionUpdate = provider.received[0] as {
      type: string;
      session: {
        type: string;
        audio: {
          input: {
            format: { type: string };
            transcription: { model: string; language: string };
            turn_detection: { type: string; silence_duration_ms: number };
          };
        };
      };
    };
    expect(sessionUpdate.type).toBe('session.update');
    expect(sessionUpdate.session.type).toBe('transcription');
    expect(sessionUpdate.session.audio.input.format.type).toBe('audio/pcmu');
    expect(sessionUpdate.session.audio.input.transcription.model).toBe('gpt-4o-transcribe');
    expect(sessionUpdate.session.audio.input.transcription.language).toBe('es');
    expect(sessionUpdate.session.audio.input.turn_detection).toEqual({
      type: 'server_vad',
      silence_duration_ms: 600,
    });

    stream.push(Buffer.from([0xff, 0xfe, 0x80]));
    await vi.waitFor(() => expect(provider.received.length).toBe(2));
    expect(provider.received[1]).toEqual({
      type: 'input_audio_buffer.append',
      audio: Buffer.from([0xff, 0xfe, 0x80]).toString('base64'),
    });

    provider.send({ type: 'input_audio_buffer.speech_started' });
    provider.send({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: '  quiero cambiar mi cita  ',
    });
    await vi.waitFor(() => expect(onUtterance).toHaveBeenCalledWith('quiero cambiar mi cita'));
    expect(onSpeechStarted).toHaveBeenCalled();

    stream.close();
    provider.close();
  });

  it('anchors the transcription language with the greeting as context bias (ADR-027 amendment)', async () => {
    const provider = await startFakeProvider();
    const transcriber = new OpenAiRealtimeTranscriber(
      { ...STT_CONFIG, apiUrl: `http://127.0.0.1:${provider.port}` },
      600,
      'Hola, soy el asistente de AURION. ¿En qué puedo ayudarte?',
    );
    await transcriber.open({ onUtterance: vi.fn(), onError: vi.fn() }, 'es-ES');
    await vi.waitFor(() => expect(provider.received.length).toBeGreaterThan(0));
    const transcription = (provider.received[0] as {
      session: { audio: { input: { transcription: { language: string; prompt: string } } } };
    }).session.audio.input.transcription;
    expect(transcription.language).toBe('es');
    expect(transcription.prompt).toContain('Hola, soy el asistente');
    provider.close();
  });

  it('rejects when the provider is unreachable — a deaf phone line fails loudly', async () => {
    const transcriber = new OpenAiRealtimeTranscriber(
      { ...STT_CONFIG, apiUrl: 'http://127.0.0.1:1', timeoutMs: 500 },
      600,
    );
    await expect(
      transcriber.open({ onUtterance: vi.fn(), onError: vi.fn() }),
    ).rejects.toThrow(/Realtime/);
  });

  it('runs its own VAD for gpt-realtime-whisper: no server turn_detection, manual commits (ADR-032)', async () => {
    const provider = await startFakeProvider();
    const transcriber = new OpenAiRealtimeTranscriber(
      { ...STT_CONFIG, apiUrl: `http://127.0.0.1:${provider.port}`, model: 'gpt-realtime-whisper' },
      400,
    );
    const onSpeechStarted = vi.fn();
    const stream = await transcriber.open(
      { onUtterance: vi.fn(), onSpeechStarted, onError: vi.fn() },
      'es-ES',
    );

    await vi.waitFor(() => expect(provider.received.length).toBeGreaterThan(0));
    const session = (provider.received[0] as {
      session: {
        audio: { input: { transcription: { delay?: string }; turn_detection?: unknown } };
      };
    }).session.audio.input;
    expect(session.turn_detection).toBeUndefined();
    expect(session.transcription.delay).toBe('low');

    // 200 ms of loud speech → onSpeechStarted, no commit yet.
    stream.push(Buffer.alloc(1600, linearToUlaw(9000)));
    await vi.waitFor(() => expect(onSpeechStarted).toHaveBeenCalled());
    expect(
      provider.received.filter((e) => (e as { type?: string }).type === 'input_audio_buffer.commit'),
    ).toHaveLength(0);

    // 400 ms of silence → exactly one manual commit.
    stream.push(Buffer.alloc(1600, 0xff));
    stream.push(Buffer.alloc(1600, 0xff));
    await vi.waitFor(() => {
      expect(
        provider.received.filter(
          (e) => (e as { type?: string }).type === 'input_audio_buffer.commit',
        ),
      ).toHaveLength(1);
    });

    stream.close();
    provider.close();
  });
});

// --- Bridge call flow ---------------------------------------------------------

const CLIENT_KEY = 'k'.repeat(32);

function fakeApi(): AurionApiPort & { closeSession: ReturnType<typeof vi.fn> } {
  return {
    startSession: async () => ({ sessionId: 'vs-1' }),
    listPublishedKnowledge: async () => [],
    requestAction: async () => ({ actionId: 'a-1', status: 'requested', approvalRequired: true }),
    getActionStatus: async () => 'requested',
    closeSession: vi.fn(async () => undefined),
  };
}

function fakeStreamingTranscriber(): {
  port: StreamingTranscriptionPort;
  handlers: () => UtteranceStreamHandlers;
  pushed: Buffer[];
  closed: () => boolean;
} {
  let captured: UtteranceStreamHandlers | null = null;
  let wasClosed = false;
  const pushed: Buffer[] = [];
  return {
    port: {
      open: async (handlers) => {
        captured = handlers;
        return {
          push: (audio) => pushed.push(audio),
          close: () => {
            wasClosed = true;
          },
        };
      },
    },
    handlers: () => captured!,
    pushed,
    closed: () => wasClosed,
  };
}

// One PCM16 24 kHz buffer of 480 samples → exactly one 160-byte wire frame.
const PCM_REPLY = Buffer.alloc(960);

interface PhoneClient {
  send(event: Record<string, unknown>): void;
  next(): Promise<Record<string, unknown>>;
  /** Abrupt drop, like a caller losing signal. */
  terminate(): void;
  closed: Promise<number>;
}

function connectPhone(port: number): Promise<PhoneClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/twilio`);
    const inbox: Record<string, unknown>[] = [];
    const waiters: Array<(event: Record<string, unknown>) => void> = [];
    const closed = new Promise<number>((resolveClose) =>
      socket.on('close', (code) => resolveClose(code)),
    );
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
        terminate: () => socket.terminate(),
        closed,
      }),
    );
  });
}

function startEvent(key: string | null): Record<string, unknown> {
  return {
    event: 'start',
    start: {
      streamSid: 'MZ1',
      callSid: 'CA1',
      ...(key ? { customParameters: { key } } : {}),
    },
  };
}

describe('Twilio bridge call flow (ADR-027: transport changes, authority does not)', () => {
  let server: Server | null = null;
  afterEach(() => {
    server?.close();
    server = null;
  });

  function boot(transcriber: StreamingTranscriptionPort, api = fakeApi()): number {
    server?.close();
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api,
      brain: new ScriptedBrain(),
      transcriber: null,
      synthesizer: null,
      twilio: {
        clientKeys: [CLIENT_KEY],
        api,
        brain: new ScriptedBrain(),
        transcriber,
        synthesizer: {
          synthesize: async () => ({ audio: PCM_REPLY, mimeType: 'audio/pcm;rate=24000' }),
        },
        telephony: {
          greeting: 'Hola, soy AURION.',
          lang: 'es-ES',
          silenceMs: 600,
          twilioAuthToken: 'twilio-token-testtesttest',
          publicUrl: 'https://aurion.test',
          sttModel: '',
          maxConcurrentCalls: 4,
          maxCallsPerDay: 200,
          backchannelMs: 0,
          routes: [],
        },
      },
      log: () => undefined,
    });
    return (server.address() as { port: number }).port;
  }

  it('answers with the greeting, runs caller turns through the SAME engine, and hangs up completed', async () => {
    const stt = fakeStreamingTranscriber();
    const api = fakeApi();
    const port = boot(stt.port, api);
    const phone = await connectPhone(port);

    phone.send(startEvent(CLIENT_KEY));
    const greeting = await phone.next();
    expect(greeting).toMatchObject({ event: 'media', streamSid: 'MZ1' });
    expect(Buffer.from((greeting as { media: { payload: string } }).media.payload, 'base64')).toHaveLength(160);

    // Caller audio is forwarded as-is to the streaming transcriber.
    phone.send({ event: 'media', media: { payload: Buffer.from('ulaw').toString('base64') } });
    await vi.waitFor(() => expect(stt.pushed.length).toBe(1));

    // A VAD-completed utterance runs engine.userTurn → the reply comes back voiced.
    stt.handlers().onUtterance('tengo un problema con mi pedido');
    expect(await phone.next()).toMatchObject({ event: 'media', streamSid: 'MZ1' });

    // Hangup closes the record as completed — silence is never an outcome.
    phone.send({ event: 'stop' });
    expect(await phone.closed).toBe(1000);
    expect(api.closeSession).toHaveBeenCalledWith(
      'vs-1',
      'completed',
      expect.objectContaining({ outcome: 'caller_hangup' }),
    );
  });

  it('barge-in: caller speech during playback clears the outbound buffer', async () => {
    const stt = fakeStreamingTranscriber();
    const port = boot(stt.port);
    const phone = await connectPhone(port);
    phone.send(startEvent(CLIENT_KEY));
    await phone.next(); // greeting
    stt.handlers().onSpeechStarted?.();
    expect(await phone.next()).toEqual({ event: 'clear', streamSid: 'MZ1' });
  });

  // --- Backchannel on slow turns (ADR-038, Fase 29 Audio Pro) ---------------

  /** A brain that answers after `ms`, plus a synthesizer that records the
   * exact texts it voices so a test can assert the spoken order. */
  function bootBackchannel(input: {
    brainMs: number;
    backchannelMs: number;
    spoken: string[];
    logs: string[];
  }): { stt: ReturnType<typeof fakeStreamingTranscriber>; port: number } {
    const stt = fakeStreamingTranscriber();
    const slowBrain: AgentBrainPort = {
      respond: async () => {
        await new Promise((resolve) => setTimeout(resolve, input.brainMs));
        return { text: 'Tu pedido llega mañana.', toolIntent: null };
      },
    };
    const recordingSynth: SpeechSynthesisPort = {
      synthesize: async (text) => {
        input.spoken.push(text);
        return { audio: PCM_REPLY, mimeType: 'audio/pcm;rate=24000' };
      },
    };
    server?.close();
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
        brain: slowBrain,
        transcriber: stt.port,
        synthesizer: recordingSynth,
        telephony: {
          greeting: 'Hola, soy AURION.',
          lang: 'es-ES',
          silenceMs: 600,
          twilioAuthToken: 'twilio-token-testtesttest',
          publicUrl: 'https://aurion.test',
          sttModel: '',
          maxConcurrentCalls: 4,
          maxCallsPerDay: 200,
          backchannelMs: input.backchannelMs,
          routes: [],
        },
      },
      log: (message) => input.logs.push(message),
    });
    return { stt, port: (server.address() as { port: number }).port };
  }

  it('fills a slow turn with a language-matched filler before the real reply (ADR-038)', async () => {
    const spoken: string[] = [];
    const logs: string[] = [];
    const { stt, port } = bootBackchannel({ brainMs: 80, backchannelMs: 20, spoken, logs });
    const phone = await connectPhone(port);
    phone.send(startEvent(CLIENT_KEY));
    await phone.next(); // greeting frame

    stt.handlers().onUtterance('¿cuándo llega mi pedido?');
    await phone.next(); // filler frame (the brain has not answered yet)
    await phone.next(); // reply frame

    await vi.waitFor(() =>
      expect(logs.some((line) => line.includes('backchannel=yes'))).toBe(true),
    );
    // The reply TEXT is the source of truth and always follows the filler.
    expect(spoken).toEqual([
      'Hola, soy AURION.',
      'Un momento, lo reviso.',
      'Tu pedido llega mañana.',
    ]);
  });

  it('does not fill a fast turn — no filler, no dead air to cover (ADR-038)', async () => {
    const spoken: string[] = [];
    const logs: string[] = [];
    const { stt, port } = bootBackchannel({ brainMs: 0, backchannelMs: 500, spoken, logs });
    const phone = await connectPhone(port);
    phone.send(startEvent(CLIENT_KEY));
    await phone.next(); // greeting frame

    stt.handlers().onUtterance('hola');
    await phone.next(); // reply frame, directly

    await vi.waitFor(() =>
      expect(logs.some((line) => line.includes('phone turn timing'))).toBe(true),
    );
    expect(logs.some((line) => line.includes('backchannel=yes'))).toBe(false);
    expect(spoken).toEqual(['Hola, soy AURION.', 'Tu pedido llega mañana.']);
  });

  it('streams PCM replies as frames and drops echoes of its own voice (ADR-032)', async () => {
    const stt = fakeStreamingTranscriber();
    const logs: string[] = [];
    // 750 samples of PCM16 @24k in two misaligned chunks → 250 μ-law bytes.
    const pcmA = Buffer.alloc(902);
    const pcmB = Buffer.alloc(598);
    server?.close();
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
        transcriber: stt.port,
        synthesizer: {
          synthesize: async () => ({ audio: Buffer.alloc(0), mimeType: 'audio/pcm' }),
          synthesizeStream: async (_text, onAudio) => {
            onAudio(pcmA);
            onAudio(pcmB);
          },
        },
        telephony: {
          greeting: 'Hola, soy AURION, tu asistente.',
          lang: 'es-ES',
          silenceMs: 600,
          twilioAuthToken: 'twilio-token-testtesttest',
          publicUrl: 'https://aurion.test',
          sttModel: '',
          maxConcurrentCalls: 4,
          maxCallsPerDay: 200,
          backchannelMs: 0,
          routes: [],
        },
      },
      log: (message) => logs.push(message),
    });
    const port = (server.address() as { port: number }).port;
    const phone = await connectPhone(port);
    phone.send(startEvent(CLIENT_KEY));

    // Greeting arrives as a whole 160-byte frame plus the 90-byte tail.
    const first = await phone.next();
    const second = await phone.next();
    const bytes = (event: unknown): number =>
      Buffer.from((event as { media: { payload: string } }).media.payload, 'base64').length;
    expect(bytes(first) + bytes(second)).toBe(250);
    expect(bytes(first)).toBe(160);

    // The line echoing our own greeting never becomes a turn.
    stt.handlers().onUtterance('Hola, soy AURION, tu asistente.');
    await vi.waitFor(() =>
      expect(logs.some((line) => line.includes('dropped as echo'))).toBe(true),
    );
    expect(logs.some((line) => line.includes('turn timing'))).toBe(false);

    // A real utterance still runs the engine and streams its reply.
    stt.handlers().onUtterance('necesito ayuda con un problema de mi pedido');
    expect(await phone.next()).toMatchObject({ event: 'media', streamSid: 'MZ1' });
    await vi.waitFor(() => expect(logs.some((line) => line.includes('turn timing'))).toBe(true));
  });

  it('caches the greeting: one synthesis per process, instant replay per call (ADR-029)', async () => {
    const stt = fakeStreamingTranscriber();
    const synthesize = vi.fn(async () => ({
      audio: Buffer.alloc(960),
      mimeType: 'audio/pcm;rate=24000',
    }));
    const twilio = {
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber: stt.port,
      synthesizer: { synthesize },
      telephony: {
        greeting: 'Hola, soy AURION.',
        lang: 'es-ES',
        silenceMs: 600,
        twilioAuthToken: 'twilio-token-testtesttest',
        publicUrl: 'https://aurion.test',
        sttModel: '',
        maxConcurrentCalls: 4,
        maxCallsPerDay: 200,
        backchannelMs: 0,
        routes: [],
      },
    };
    server?.close();
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber: null,
      synthesizer: null,
      twilio,
      log: () => undefined,
    });
    const port = (server.address() as { port: number }).port;

    const first = await connectPhone(port);
    first.send(startEvent(CLIENT_KEY));
    expect(await first.next()).toMatchObject({ event: 'media' });
    expect(synthesize).toHaveBeenCalledTimes(1);

    const second = await connectPhone(port);
    second.send({
      event: 'start',
      start: { streamSid: 'MZ2', callSid: 'CA2', customParameters: { key: CLIENT_KEY } },
    });
    const replay = await second.next();
    expect(replay).toMatchObject({ event: 'media', streamSid: 'MZ2' });
    // Same options object → the greeting replayed from cache, no new synthesis.
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('voices MP3 synthesis through the injected transcoder (ADR-029, operator voice)', async () => {
    const stt = fakeStreamingTranscriber();
    const ulaw = Buffer.alloc(160, 0x7f);
    server?.close();
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
        transcriber: stt.port,
        synthesizer: {
          synthesize: async () => ({ audio: Buffer.from('mp3-bytes'), mimeType: 'audio/mpeg' }),
        },
        mp3ToUlaw: async () => ulaw,
        telephony: {
          greeting: 'Hola, soy Daniel.',
          lang: 'es-ES',
          silenceMs: 600,
          twilioAuthToken: 'twilio-token-testtesttest',
          publicUrl: 'https://aurion.test',
          sttModel: '',
          maxConcurrentCalls: 4,
          maxCallsPerDay: 200,
          backchannelMs: 0,
          routes: [],
        },
      },
      log: () => undefined,
    });
    const port = (server.address() as { port: number }).port;
    const phone = await connectPhone(port);
    phone.send(startEvent(CLIENT_KEY));
    const greeting = await phone.next();
    expect(greeting).toMatchObject({ event: 'media', streamSid: 'MZ1' });
    expect(
      Buffer.from((greeting as { media: { payload: string } }).media.payload, 'base64').equals(ulaw),
    ).toBe(true);
  });

  it('routes a call to the tenant whose client key it carries (ADR-035)', async () => {
    const tenantA = { startSession: vi.fn(async () => ({ sessionId: 'A-1' })), listPublishedKnowledge: async () => [], requestAction: async () => ({ actionId: 'a', status: 'requested', approvalRequired: true }), getActionStatus: async () => 'requested', closeSession: async () => undefined };
    const tenantB = { startSession: vi.fn(async () => ({ sessionId: 'B-1' })), listPublishedKnowledge: async () => [], requestAction: async () => ({ actionId: 'b', status: 'requested', approvalRequired: true }), getActionStatus: async () => 'requested', closeSession: async () => undefined };
    const KEY_B = 'tenant-b-key-'.padEnd(32, 'b');
    const stt2 = fakeStreamingTranscriber();
    server?.close();
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber: null,
      synthesizer: null,
      twilio: {
        clientKeys: [CLIENT_KEY, KEY_B],
        api: tenantA,
        routes: new Map([[KEY_B, { api: tenantB, greeting: 'Hola desde B.', lang: 'es-ES' }]]),
        brain: new ScriptedBrain(),
        transcriber: stt2.port,
        synthesizer: { synthesize: async () => ({ audio: PCM_REPLY, mimeType: 'audio/pcm;rate=24000' }) },
        telephony: {
          greeting: 'Hola desde A.',
          lang: 'es-ES',
          silenceMs: 600,
          twilioAuthToken: 'twilio-token-testtesttest',
          publicUrl: 'https://aurion.test',
          sttModel: '',
          maxConcurrentCalls: 4,
          maxCallsPerDay: 200,
          backchannelMs: 0,
          routes: [],
        },
      },
      log: () => undefined,
    });
    const port = (server.address() as { port: number }).port;
    const phone = await connectPhone(port);
    phone.send({ event: 'start', start: { streamSid: 'MZb', callSid: 'CAb', customParameters: { key: KEY_B } } });
    await phone.next();
    await vi.waitFor(() => expect(tenantB.startSession).toHaveBeenCalledWith('tw-CAb'));
    expect(tenantA.startSession).not.toHaveBeenCalled();
    phone.send({ event: 'stop' });
    await phone.closed;
  });

  it('rejects calls without a valid key before any audio is processed', async () => {
    const stt = fakeStreamingTranscriber();
    const port = boot(stt.port);

    const noKey = await connectPhone(port);
    noKey.send(startEvent(null));
    expect(await noKey.closed).toBe(4401);

    const badKey = await connectPhone(port);
    badKey.send(startEvent('wrong-key-wrong-key-wrong-key!!'));
    expect(await badKey.closed).toBe(4401);
    expect(stt.pushed).toHaveLength(0);
  });

  it('closes on malformed frames, and a dropped call is recorded as failed', async () => {
    const stt = fakeStreamingTranscriber();
    const api = fakeApi();
    const port = boot(stt.port, api);

    const malformed = await connectPhone(port);
    malformed.send('not json' as never);
    expect(await malformed.closed).toBe(1008);

    // A started call dropped mid-air is recorded as failed (ADR-018 by phone).
    const phone = await connectPhone(port);
    phone.send(startEvent(CLIENT_KEY));
    await phone.next(); // greeting ensures the session started
    phone.terminate();
    await vi.waitFor(() =>
      expect(api.closeSession).toHaveBeenCalledWith(
        'vs-1',
        'failed',
        expect.objectContaining({ outcome: 'connection_dropped' }),
      ),
    );
    expect(stt.closed()).toBe(true);
  });

  it('serves signed TwiML on /twiml and refuses everything else (ADR-028)', async () => {
    const { createHmac } = await import('node:crypto');
    const stt = fakeStreamingTranscriber();
    const port = boot(stt.port);
    const base = `http://127.0.0.1:${port}`;
    const publicUrl = 'https://aurion.test/twiml';
    const body = new URLSearchParams({ CallSid: 'CA1', From: '+34600000000' });
    const params = Object.fromEntries(body);
    const payload =
      publicUrl +
      Object.keys(params)
        .sort()
        .map((name) => name + params[name])
        .join('');
    const signature = createHmac('sha1', 'twilio-token-testtesttest')
      .update(payload)
      .digest('base64');

    const signed = await fetch(`${base}/twiml`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': signature,
      },
      body: body.toString(),
    });
    expect(signed.status).toBe(200);
    const twiml = await signed.text();
    expect(twiml).toContain('wss://aurion.test/twilio');
    expect(twiml).toContain(`value="${CLIENT_KEY}"`);

    const forged = await fetch(`${base}/twiml`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'AAAA',
      },
      body: body.toString(),
    });
    expect(forged.status).toBe(403);

    const unsigned = await fetch(`${base}/twiml`, { method: 'POST', body: body.toString() });
    expect(unsigned.status).toBe(403);

    const got = await fetch(`${base}/twiml`);
    expect(got.status).toBe(405);
  });

  it('does not serve /twiml when telephony is off', async () => {
    server?.close();
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber: null,
      synthesizer: null,
      twilio: null,
      log: () => undefined,
    });
    const port = (server.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/twiml`, { method: 'POST', body: '' });
    expect(response.status).toBe(426);
  });

  it('refuses /twilio upgrades when telephony is off', async () => {
    server?.close();
    server = startWsServer({
      port: 0,
      clientKeys: [CLIENT_KEY],
      api: fakeApi(),
      brain: new ScriptedBrain(),
      transcriber: null,
      synthesizer: null,
      twilio: null,
      log: () => undefined,
    });
    const port = (server.address() as { port: number }).port;
    await expect(connectPhone(port)).rejects.toThrow();
  });
});
