import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';

import { WebSocket, WebSocketServer } from 'ws';

import { ConversationEngine, EngineError } from '../application/conversation-engine.js';
import type {
  AgentBrainPort,
  AurionApiPort,
  SpeechSynthesisPort,
  TranscriptionPort,
} from '../application/ports.js';
import { SpeechSynthesisError } from './openai-speech.js';
import { TranscriptionError } from './openai-transcriber.js';
import { CallCapacity } from './call-capacity.js';
import { handleTwilioCall, type TwilioBridgeOptions } from './twilio-bridge.js';
import { buildBusyTwiml, buildTwiml, validateTwilioSignature } from './twiml.js';
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
 *
 * One port, two upgrade paths: `/ws` (widget contract) and — when
 * telephony is configured — `/twilio` (Media Streams bridge, ADR-027).
 */
export interface WsServerOptions {
  readonly port: number;
  readonly clientKeys: readonly string[];
  readonly api: AurionApiPort;
  readonly brain: AgentBrainPort;
  /** Server-side STT (ADR-025); null answers audio.utterance with stt_disabled. */
  readonly transcriber: TranscriptionPort | null;
  /** Server-side TTS (ADR-026); null means replies are text-only. */
  readonly synthesizer: SpeechSynthesisPort | null;
  /** Telephony bridge (ADR-027); null means /twilio upgrades are refused. */
  readonly twilio?: TwilioBridgeOptions | null;
  readonly maxAudioBytes?: number;
  readonly log?: (message: string) => void;
}

export function startWsServer(options: WsServerOptions): Server {
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  const server = new WebSocketServer({ noServer: true });

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
      // Voice is an enhancement (ADR-026): the text above is already out,
      // so a synthesis failure costs the audio, never the answer.
      if (options.synthesizer && result.reply.length > 0) {
        const speech = await options.synthesizer.synthesize(result.reply);
        send({
          type: 'audio.agent',
          audio: speech.audio.toString('base64'),
          mime_type: speech.mimeType,
        });
      }
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
                tts_enabled: options.synthesizer !== null,
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
          if (error instanceof SpeechSynthesisError) {
            log(`tts failure: ${error.message}`);
            send({
              type: 'error',
              code: 'tts_failed',
              message: 'The reply could not be voiced; the text above stands.',
            });
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

  // Cost guard (ADR-034): one shared meter between the TwiML door and the
  // call bridge — over-capacity calls are answered politely and never
  // touch the billed providers.
  const capacity = options.twilio
    ? new CallCapacity(
        options.twilio.telephony.maxConcurrentCalls,
        options.twilio.telephony.maxCallsPerDay,
      )
    : null;

  const twilioServer = options.twilio ? new WebSocketServer({ noServer: true }) : null;
  twilioServer?.on('connection', (socket: WebSocket) => {
    handleTwilioCall(socket, { ...options.twilio!, capacity: capacity!, log });
  });

  const httpServer = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://gateway').pathname;
    // The phone number's front door (ADR-028): TwiML carrying the client
    // key, handed ONLY to requests Twilio signed.
    if (pathname === '/twiml' && options.twilio) {
      if (request.method !== 'POST') {
        response.writeHead(405, { 'content-type': 'text/plain' });
        response.end('POST only.');
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 16_384) {
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        const telephony = options.twilio!.telephony;
        const params = Object.fromEntries(
          new URLSearchParams(Buffer.concat(chunks).toString('utf8')),
        );
        const signature = request.headers['x-twilio-signature'];
        if (
          typeof signature !== 'string' ||
          !validateTwilioSignature(
            telephony.twilioAuthToken,
            `${telephony.publicUrl}/twiml`,
            params,
            signature,
          )
        ) {
          response.writeHead(403, { 'content-type': 'text/plain' });
          response.end('Invalid Twilio signature.');
          return;
        }
        if (capacity && !capacity.hasRoom()) {
          const used = capacity.snapshot();
          log(`call refused at capacity: active=${used.active} today=${used.today} (ADR-034)`);
          response.writeHead(200, { 'content-type': 'text/xml' });
          response.end(buildBusyTwiml(telephony.lang));
          return;
        }
        response.writeHead(200, { 'content-type': 'text/xml' });
        response.end(buildTwiml(telephony.publicUrl, options.clientKeys[0]));
      });
      return;
    }
    response.writeHead(426, { 'content-type': 'text/plain' });
    response.end('WebSocket only.');
  });
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://gateway').pathname;
    if (pathname === '/ws') {
      server.handleUpgrade(request, socket, head, (ws) => server.emit('connection', ws, request));
    } else if (pathname === '/twilio' && twilioServer) {
      twilioServer.handleUpgrade(request, socket, head, (ws) =>
        twilioServer.emit('connection', ws),
      );
    } else {
      socket.destroy();
    }
  });
  httpServer.on('close', () => {
    server.close();
    twilioServer?.close();
  });
  httpServer.listen(options.port);

  log(
    `voice gateway listening on :${options.port}/ws${options.twilio ? ' and /twilio (ADR-027)' : ''}`,
  );
  return httpServer;
}
