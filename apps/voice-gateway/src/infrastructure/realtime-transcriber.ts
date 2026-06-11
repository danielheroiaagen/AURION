import { WebSocket } from 'ws';

import type { SttConfig } from '../config.js';
import type {
  StreamingTranscriptionPort,
  UtteranceStream,
  UtteranceStreamHandlers,
} from '../application/ports.js';
import { ulawToLinear } from './audio.js';

/** Mean absolute amplitude above which a μ-law frame counts as speech
 * (16-bit scale; telephone speech typically averages well above 1000). */
const SPEECH_THRESHOLD = 350;
/** μ-law 8 kHz: 8 bytes per millisecond. */
const BYTES_PER_MS = 8;
/** Never commit less than this much detected speech (provider minimum). */
const MIN_SPEECH_MS = 120;

function meanAbsAmplitude(ulaw: Buffer): number {
  if (ulaw.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < ulaw.length; index += 1) {
    sum += Math.abs(ulawToLinear(ulaw[index]));
  }
  return sum / ulaw.length;
}

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
    /** Context bias, e.g. the phone greeting: anchors the transcription
     * language far harder than the optional `language` hint alone (a
     * Spanish caller was transcribed as English on a live call). */
    private readonly biasPrompt: string | null = null,
    private readonly wsFactory: WsFactory = (url, headers) => new WebSocket(url, { headers }),
  ) {}

  open(handlers: UtteranceStreamHandlers, lang?: string): Promise<UtteranceStream> {
    const url = `${this.config.apiUrl.replace(/^http/, 'ws')}/realtime?intent=transcription`;
    const socket = this.wsFactory(url, { authorization: `Bearer ${this.config.apiKey}` });
    // gpt-realtime-whisper streams natively but takes NO server VAD: the
    // adapter segments utterances itself from the μ-law energy and commits
    // manually (ADR-032). Other models keep the provider's server_vad.
    const manualVad = this.config.model.includes('realtime-whisper');

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
                    ...(this.biasPrompt && !manualVad ? { prompt: this.biasPrompt } : {}),
                    ...(manualVad ? { delay: 'low' } : {}),
                  },
                  ...(manualVad
                    ? {}
                    : {
                        turn_detection: {
                          type: 'server_vad',
                          silence_duration_ms: this.silenceMs,
                        },
                      }),
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

        // Manual VAD state (gpt-realtime-whisper only): millisecond
        // bookkeeping derived from byte counts — μ-law 8 kHz is 8 B/ms.
        let speaking = false;
        let speechMs = 0;
        let silentMs = 0;

        resolve({
          push: (audio: Buffer): void => {
            if (socket.readyState !== WebSocket.OPEN) {
              return;
            }
            socket.send(
              JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: audio.toString('base64'),
              }),
            );
            if (!manualVad) {
              return;
            }
            const chunkMs = audio.length / BYTES_PER_MS;
            if (meanAbsAmplitude(audio) >= SPEECH_THRESHOLD) {
              if (!speaking) {
                speaking = true;
                handlers.onSpeechStarted?.();
              }
              speechMs += chunkMs;
              silentMs = 0;
              return;
            }
            if (!speaking) {
              return;
            }
            silentMs += chunkMs;
            if (silentMs >= this.silenceMs && speechMs >= MIN_SPEECH_MS) {
              speaking = false;
              speechMs = 0;
              silentMs = 0;
              socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
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
