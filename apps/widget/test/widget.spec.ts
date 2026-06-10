import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConversationClient,
  forgetSession,
  resumableSessionId,
} from '../src/conversation-client';
import { parseServerEvent } from '../src/protocol';
import { listenOnce, speechInputAvailable, speechOutputAvailable } from '../src/speech';

// --- Mock WebSocket ---------------------------------------------------------

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.emit('close', {});
  }

  // test helpers
  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open', {});
  }

  receive(event: unknown): void {
    this.emit('message', { data: JSON.stringify(event) });
  }

  private emit(type: string, event: unknown): void {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

function lastSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

const CONFIG = { gatewayUrl: 'ws://gateway.test/ws', clientKey: 'k'.repeat(32) };

describe('resumable session id', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('is stable across reconnects and spent on session.end', () => {
    const first = resumableSessionId();
    expect(resumableSessionId()).toBe(first); // a reconnect resumes the SAME record
    forgetSession();
    expect(resumableSessionId()).not.toBe(first);
  });
});

describe('ConversationClient', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    MockWebSocket.instances = [];
  });

  async function connected(callbacks = { onEvent: vi.fn(), onClose: vi.fn() }) {
    const client = new ConversationClient(CONFIG, callbacks);
    const connecting = client.connect();
    lastSocket().open();
    await connecting;
    return { client, socket: lastSocket(), callbacks };
  }

  it('connects with the client key and starts with the resumable id', async () => {
    const { socket } = await connected();
    expect(socket.url).toContain('key=' + CONFIG.clientKey);
    const start = JSON.parse(socket.sent[0]);
    expect(start.type).toBe('session.start');
    expect(start.external_session_id).toBe(resumableSessionId());
  });

  it('sends turns and polls, and surfaces server events through callbacks', async () => {
    const { client, socket, callbacks } = await connected();
    client.sendTurn('hola');
    client.pollAction('a-1');
    expect(JSON.parse(socket.sent[1])).toEqual({ type: 'turn.user', text: 'hola' });
    expect(JSON.parse(socket.sent[2])).toEqual({ type: 'action.poll', action_id: 'a-1' });

    socket.receive({ type: 'turn.agent', text: 'puedo ayudarte' });
    socket.receive({
      type: 'action.requested',
      action_id: 'a-1',
      action_type: 'ticket.create',
      approval_pending: true,
    });
    expect(callbacks.onEvent).toHaveBeenCalledTimes(2);
    // The approval-pending flag reaches the caller — honesty end to end.
    expect(callbacks.onEvent.mock.calls[1][0].approval_pending).toBe(true);
  });

  it('drops malformed and unknown server frames instead of crashing', async () => {
    const { callbacks } = await connected();
    expect(parseServerEvent('not json')).toBeNull();
    expect(parseServerEvent(JSON.stringify({ type: 'hack.me' }))).toBeNull();
    expect(parseServerEvent(JSON.stringify({ type: 'turn.agent', text: 'ok' }))).not.toBeNull();
    expect(callbacks.onEvent).not.toHaveBeenCalled();
  });

  it('ending the call spends the resume id', async () => {
    const { client } = await connected();
    const id = resumableSessionId();
    client.end('caller_ended');
    expect(window.sessionStorage.getItem('aurion.widget.external_session_id')).toBeNull();
    expect(resumableSessionId()).not.toBe(id);
  });
});

describe('speech availability (graceful degradation)', () => {
  it('detects absence of speech APIs — text fallback is the experience', () => {
    const bare = {} as typeof globalThis;
    expect(speechInputAvailable(bare)).toBe(false);
    expect(speechOutputAvailable(bare)).toBe(false);
  });

  it('resolves recognized text through a mocked recognizer', async () => {
    class FakeRecognition {
      lang = '';
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null =
        null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      start(): void {
        this.onresult?.({ results: [[{ transcript: 'quiero cambiar mi cita' }]] });
      }
      stop(): void {}
    }
    const scope = { SpeechRecognition: FakeRecognition } as unknown as typeof globalThis;
    expect(speechInputAvailable(scope)).toBe(true);
    expect(await listenOnce('es-ES', scope)).toEqual({ ok: true, text: 'quiero cambiar mi cita' });
  });

  it('explains every capture failure — never a silent null (mic UX bug fix)', async () => {
    function recognizerThat(fire: (recognition: {
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
    }) => void) {
      return class {
        lang = '';
        interimResults = false;
        maxAlternatives = 1;
        onresult = null;
        onend: (() => void) | null = null;
        onerror: ((event: { error: string }) => void) | null = null;
        start(): void {
          fire(this);
        }
        stop(): void {}
      };
    }

    const denied = { SpeechRecognition: recognizerThat((r) => r.onerror?.({ error: 'not-allowed' })) };
    expect(await listenOnce('es-ES', denied as unknown as typeof globalThis)).toEqual({
      ok: false,
      reason: 'not-allowed',
    });

    const offline = { SpeechRecognition: recognizerThat((r) => r.onerror?.({ error: 'network' })) };
    expect(await listenOnce('es-ES', offline as unknown as typeof globalThis)).toEqual({
      ok: false,
      reason: 'network',
    });

    // Recognition that ends with neither result nor error = nothing heard.
    const silent = { SpeechRecognition: recognizerThat((r) => r.onend?.()) };
    expect(await listenOnce('es-ES', silent as unknown as typeof globalThis)).toEqual({
      ok: false,
      reason: 'no-speech',
    });

    expect(await listenOnce('es-ES', {} as typeof globalThis)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});
