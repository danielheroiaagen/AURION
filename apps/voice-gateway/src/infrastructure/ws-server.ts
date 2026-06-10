import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { WebSocket, WebSocketServer } from 'ws';

import { ConversationEngine, EngineError } from '../application/conversation-engine.js';
import type { AgentBrainPort, AurionApiPort, TranscriptionPort } from '../application/ports.js';
import { TranscriptionError } from './openai-transcriber.js';
import {
  parseClientEvent,
  ProtocolError,
  serializeServerEvent,
  type ServerEvent,
} from './protocol.js';

/**
 * WebSocket transport (ADR-018): key-gated handshake, one conversation
 * engine per connection, protocol errors keep the socket alive, socket
 * close finalizes the session (`completed` after session.end, `failed`
 * on an abrupt drop).
 */
export interface WsServerOptions {
  readonly port: number;
  readonly clientKeys: readonly string[];
  readonly api: AurionApiPort;
  readonly brain: AgentBrainPort;
  /** Server-side STT (ADR-025); null answers audio.utterance with stt_disabled. */
  readonly transcriber: TranscriptionPort | null;
  readonly maxAudioBytes?: number;
  readonly log?: (message: string) => void;
}

export function startWsServer(options: WsServerOptions): WebSocketServer {
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  const server = new WebSocketServer({ port: options.port, path: '/ws' });

  server.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    const key = new URL(request.url ?? '/', 'http://gateway').searchParams.get('key');
    if (!key || !options.clientKeys.includes(key)) {
      socket.close(4401, 'Missing or invalid client key.');
      return;
    }

    const engine = new ConversationEngine(options.api, options.brain);
    let endedGracefully = false;

    const send = (event: ServerEvent): void => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serializeServerEvent(event));
      }
    };

    const runTurn = async (text: string): Promise<void> => {
      const result = await engine.userTurn(text);
      if (result.requestedAction) {
        send({
          type: 'action.requested',
          action_id: result.requestedAction.actionId,
          action_type: result.requestedAction.actionType,
          approval_pending: true,
        });
      }
      send({ type: 'turn.agent', text: result.reply });
    };

    socket.on('message', (raw) => {
      void (async () => {
        try {
          const event = parseClientEvent(raw as Buffer);
          switch (event.type) {
            case 'session.start': {
              const sessionId = await engine.start(
                event.external_session_id ?? `vg-${randomUUID()}`,
              );
              send({
                type: 'session.started',
                session_id: sessionId,
                stt_enabled: options.transcriber !== null,
              });
              break;
            }
            case 'turn.user': {
              await runTurn(event.text);
              break;
            }
            case 'audio.utterance': {
              // Capture changes, authority does not (ADR-025): a transcribed
              // utterance runs the SAME turn path as a typed one.
              if (!options.transcriber) {
                send({
                  type: 'error',
                  code: 'stt_disabled',
                  message: 'This gateway has no speech-to-text configured.',
                });
                break;
              }
              const audio = Buffer.from(event.audio, 'base64');
              if (audio.length === 0 || audio.length > (options.maxAudioBytes ?? 2_000_000)) {
                send({
                  type: 'error',
                  code: 'audio_too_large',
                  message: 'Utterance audio is empty or exceeds the size cap.',
                });
                break;
              }
              const text = await options.transcriber.transcribe({
                audio,
                mimeType: event.mime_type,
                lang: event.lang,
              });
              send({ type: 'audio.transcript', text });
              if (text.length > 0) {
                await runTurn(text);
              }
              break;
            }
            case 'action.poll': {
              const status = await engine.pollAction(event.action_id);
              send({ type: 'action.update', action_id: event.action_id, status });
              break;
            }
            case 'session.end': {
              const closed = await engine.end(event.outcome);
              endedGracefully = true;
              send({ type: 'session.ended', session_id: closed.sessionId, status: closed.status });
              socket.close(1000, 'Session ended.');
              break;
            }
          }
        } catch (error) {
          if (error instanceof ProtocolError || error instanceof EngineError) {
            send({ type: 'error', code: error.code, message: error.message });
            return;
          }
          if (error instanceof TranscriptionError) {
            log(`stt failure: ${error.message}`);
            send({ type: 'error', code: 'stt_failed', message: 'Speech could not be transcribed.' });
            return;
          }
          log(`upstream failure: ${error instanceof Error ? error.message : String(error)}`);
          send({ type: 'error', code: 'upstream_failed', message: 'Upstream request failed.' });
        }
      })();
    });

    socket.on('close', () => {
      // An abrupt drop with a live session is recorded as `failed` —
      // silence is never an outcome (ADR-018).
      if (engine.isStarted && !engine.isClosed && !endedGracefully) {
        void engine.abort('connection_dropped');
      }
    });
  });

  log(`voice gateway listening on :${options.port}/ws`);
  return server;
}
