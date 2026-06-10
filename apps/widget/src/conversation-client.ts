import { parseServerEvent, type ClientEvent, type ServerEvent } from './protocol';

/**
 * The widget's only WebSocket door (ADR-024). Callback-driven so the UI and
 * the speech layer stay decoupled, with reconnect-resume: the
 * `external_session_id` persists in sessionStorage, and the gateway's
 * natural idempotency (ADR-018) makes a resumed connection continue the
 * SAME conversation record.
 */
export interface ConversationCallbacks {
  onEvent(event: ServerEvent): void;
  onClose(): void;
}

export interface ConversationConfig {
  readonly gatewayUrl: string;
  readonly clientKey: string;
}

const SESSION_KEY = 'aurion.widget.external_session_id';

export function resumableSessionId(storage: Storage = window.sessionStorage): string {
  const existing = storage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }
  const fresh = `web-${crypto.randomUUID()}`;
  storage.setItem(SESSION_KEY, fresh);
  return fresh;
}

export function forgetSession(storage: Storage = window.sessionStorage): void {
  storage.removeItem(SESSION_KEY);
}

export class ConversationClient {
  private socket: WebSocket | null = null;

  constructor(
    private readonly config: ConversationConfig,
    private readonly callbacks: ConversationCallbacks,
    private readonly storage: Storage = window.sessionStorage,
  ) {}

  /** Connect and start (or resume) the conversation. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.gatewayUrl);
      url.searchParams.set('key', this.config.clientKey);
      const socket = new WebSocket(url.toString());
      this.socket = socket;

      socket.addEventListener('open', () => {
        this.send({ type: 'session.start', external_session_id: resumableSessionId(this.storage) });
        resolve();
      });
      socket.addEventListener('error', () => reject(new Error('Could not reach the voice gateway.')));
      socket.addEventListener('close', () => this.callbacks.onClose());
      socket.addEventListener('message', (message: MessageEvent<string>) => {
        const event = parseServerEvent(message.data);
        if (event) {
          this.callbacks.onEvent(event);
        }
      });
    });
  }

  sendTurn(text: string): void {
    this.send({ type: 'turn.user', text });
  }

  /** One recorded utterance for server-side transcription (ADR-025). */
  sendUtterance(audioBase64: string, mimeType: string, lang?: string): void {
    this.send({ type: 'audio.utterance', audio: audioBase64, mime_type: mimeType, lang });
  }

  pollAction(actionId: string): void {
    this.send({ type: 'action.poll', action_id: actionId });
  }

  /** Graceful end: the record closes `completed` and the resume id is spent. */
  end(outcome?: string): void {
    this.send({ type: 'session.end', outcome });
    forgetSession(this.storage);
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  private send(event: ClientEvent): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }
  }
}
