import { WebSocket } from 'ws';

import type { SttConfig } from '../config.js';
import type {
  StreamingTranscriptionPort,
  UtteranceStream,
  UtteranceStreamHandlers,
} from '../application/ports.js';

/**
 * OpenAI Realtime transcription adapter (ADR-027). A WebSocket CLIENT on
 * the `ws` package the gateway already ships — no SDK, no new deps.
 *
 * The phone wire format (G.711 μ-law 8 kHz) is forwarded as-is: the
 * Realtime API accepts `audio/pcmu` directly, and its server VAD decides
 * where utterances end. Privacy boundary unchanged (ADR-025): audio goes
 * to the provider and is dropped; only transcript TEXT flows on.
 */
export class RealtimeTranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RealtimeTranscriptionError';
  }
}

type WsFactory = (url: string, headers: Record<string, string>) => WebSocket;

export class OpenAiRealtimeTranscriber implements StreamingTranscriptionPort {
  constructor(
    private readonly config: SttConfig,
    private readonly silenceMs: number,
    private readonly wsFactory: WsFactory = (url, headers) => new WebSocket(url, { headers }),
  ) {}

  open(handlers: UtteranceStreamHandlers, lang?: string): Promise<UtteranceStream> {
    const url = `${this.config.apiUrl.replace(/^http/, 'ws')}/realtime?intent=transcription`;
    const socket = this.wsFactory(url, { authorization: `Bearer ${this.config.apiKey}` });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(
          new RealtimeTranscriptionError(
            `Realtime endpoint did not open within ${this.config.timeoutMs}ms.`,
          ),
        );
      }, this.config.timeoutMs);

      socket.on('error', (error: Error) => {
        clearTimeout(timer);
        reject(new RealtimeTranscriptionError(`Realtime socket failed: ${error.message}`));
        handlers.onError(new RealtimeTranscriptionError(error.message));
      });

      socket.on('open', () => {
        clearTimeout(timer);
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'transcription',
              audio: {
                input: {
                  format: { type: 'audio/pcmu' },
                  transcription: {
                    model: this.config.model,
                    ...(lang ? { language: lang.split('-')[0].toLowerCase() } : {}),
                  },
                  turn_detection: {
                    type: 'server_vad',
                    silence_duration_ms: this.silenceMs,
                  },
                },
              },
            },
          }),
        );

        socket.on('message', (raw) => {
          let event: { type?: unknown; transcript?: unknown; error?: { message?: unknown } };
          try {
            event = JSON.parse(String(raw));
          } catch {
            return; // not ours to crash a live call over
          }
          switch (event.type) {
            case 'input_audio_buffer.speech_started':
              handlers.onSpeechStarted?.();
              break;
            case 'conversation.item.input_audio_transcription.completed':
              handlers.onUtterance(
                typeof event.transcript === 'string' ? event.transcript.trim() : '',
              );
              break;
            case 'error':
              handlers.onError(
                new RealtimeTranscriptionError(
                  typeof event.error?.message === 'string'
                    ? event.error.message
                    : 'Realtime session error.',
                ),
              );
              break;
            default:
              break; // deltas and lifecycle events we do not need
          }
        });

        resolve({
          push: (audio: Buffer): void => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  type: 'input_audio_buffer.append',
                  audio: audio.toString('base64'),
                }),
              );
            }
          },
          close: (): void => {
            socket.close();
          },
        });
      });
    });
  }
}
