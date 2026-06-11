import { WebSocket } from 'ws';

import { ConversationEngine } from '../application/conversation-engine.js';
import type {
  AgentBrainPort,
  AurionApiPort,
  SpeechSynthesisPort,
  StreamingTranscriptionPort,
  UtteranceStream,
} from '../application/ports.js';
import type { TelephonyConfig } from '../config.js';
import { pcm16ToUlaw8k, ulawFrames } from './audio.js';
import { parseTwilioEvent, TwilioProtocolError } from './twilio-protocol.js';

/**
 * Twilio Media Streams bridge (ADR-027): a phone call in front of the
 * SAME ConversationEngine the widget uses. The bridge changes transport,
 * never authority — actions stay approval-gated, sessions stay recorded
 * (`completed` on hangup, `failed` on drop), silence is never an outcome.
 */
export interface TwilioBridgeOptions {
  readonly clientKeys: readonly string[];
  readonly api: AurionApiPort;
  readonly brain: AgentBrainPort;
  readonly transcriber: StreamingTranscriptionPort;
  /** Must synthesize PCM (ADR-026 `pcm` format) — the bridge owns the μ-law wire. */
  readonly synthesizer: SpeechSynthesisPort;
  readonly telephony: TelephonyConfig;
  readonly log?: (message: string) => void;
}

const APOLOGY = 'Disculpa, ha habido un problema técnico. ¿Puedes repetirlo?';

export function handleTwilioCall(socket: WebSocket, options: TwilioBridgeOptions): void {
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  const engine = new ConversationEngine(options.api, options.brain);
  let streamSid: string | null = null;
  let stream: UtteranceStream | null = null;
  let endedGracefully = false;
  // Turns are serialized: a caller who talks over a pending turn queues,
  // preserving the engine's turn-keyed idempotency.
  let turnChain: Promise<void> = Promise.resolve();

  const sendFrames = (ulaw: Buffer): void => {
    if (socket.readyState !== WebSocket.OPEN || !streamSid) {
      return;
    }
    for (const frame of ulawFrames(ulaw)) {
      socket.send(
        JSON.stringify({
          event: 'media',
          streamSid,
          media: { payload: frame.toString('base64') },
        }),
      );
    }
  };

  const say = async (text: string): Promise<void> => {
    const speech = await options.synthesizer.synthesize(text);
    if (!speech.mimeType.startsWith('audio/pcm')) {
      throw new Error(`Telephony needs PCM synthesis, got ${speech.mimeType}.`);
    }
    sendFrames(pcm16ToUlaw8k(speech.audio));
  };

  const runTurn = (text: string): void => {
    turnChain = turnChain.then(async () => {
      try {
        // action.requested has no audio analog: the reply TEXT already
        // tells the caller honestly that the request awaits approval
        // (ADR-013) — the brain's words are the phone UI.
        const result = await engine.userTurn(text);
        await say(result.reply);
      } catch (error) {
        log(`phone turn failed: ${error instanceof Error ? error.message : String(error)}`);
        try {
          await say(APOLOGY);
        } catch {
          // Voice is down too; the stop/drop path will close the record.
        }
      }
    });
  };

  socket.on('message', (raw) => {
    void (async () => {
      try {
        const event = parseTwilioEvent(raw as Buffer);
        switch (event.type) {
          case 'start': {
            // Same no-unauthenticated-mode rule as /ws: the TwiML must
            // carry <Parameter name="key"> matching a configured key.
            if (!event.key || !options.clientKeys.includes(event.key)) {
              socket.close(4401, 'Missing or invalid client key.');
              return;
            }
            streamSid = event.streamSid;
            await engine.start(`tw-${event.callSid}`);
            stream = await options.transcriber.open(
              {
                onUtterance: (text) => {
                  if (text.length > 0) {
                    runTurn(text);
                  }
                },
                onSpeechStarted: () => {
                  // Barge-in v1 (ADR-027): the caller talks, the agent yields.
                  if (socket.readyState === WebSocket.OPEN && streamSid) {
                    socket.send(JSON.stringify({ event: 'clear', streamSid }));
                  }
                },
                onError: (error) => {
                  log(`phone stt failed: ${error.message}`);
                  socket.close(1011, 'Transcription stream failed.');
                },
              },
              options.telephony.lang,
            );
            await say(options.telephony.greeting);
            break;
          }
          case 'media': {
            stream?.push(Buffer.from(event.payload, 'base64'));
            break;
          }
          case 'stop': {
            if (engine.isStarted && !engine.isClosed) {
              endedGracefully = true;
              await engine.end('caller_hangup');
            }
            socket.close(1000, 'Call ended.');
            break;
          }
          default:
            break; // connected / ignored
        }
      } catch (error) {
        if (error instanceof TwilioProtocolError) {
          log(`twilio protocol error: ${error.message}`);
          socket.close(1008, 'Malformed Twilio frame.');
          return;
        }
        log(`phone call failure: ${error instanceof Error ? error.message : String(error)}`);
        socket.close(1011, 'Upstream failure.');
      }
    })();
  });

  socket.on('close', () => {
    stream?.close();
    // An abrupt drop with a live session is recorded as `failed` —
    // silence is never an outcome (ADR-018), by phone either.
    if (engine.isStarted && !engine.isClosed && !endedGracefully) {
      void engine.abort('connection_dropped');
    }
  });
}
