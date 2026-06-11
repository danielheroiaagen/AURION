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
  /** PCM (ADR-026 `pcm` format) or MP3 with a transcoder — the bridge owns the μ-law wire. */
  readonly synthesizer: SpeechSynthesisPort;
  /** MP3 → μ-law decode for non-PCM synthesizers (ADR-029, ffmpeg-backed). */
  readonly mp3ToUlaw?: ((mp3: Buffer) => Promise<Buffer>) | null;
  readonly telephony: TelephonyConfig;
  readonly log?: (message: string) => void;
}

const APOLOGY = 'Disculpa, ha habido un problema técnico. ¿Puedes repetirlo?';

/** Accent/punctuation-insensitive form for the echo guard. */
function normalizeForEcho(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function handleTwilioCall(socket: WebSocket, options: TwilioBridgeOptions): void {
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  // The phone line's language pins the brain's reply language (a caller
  // greeted in Portuguese once — never again).
  const engine = new ConversationEngine(options.api, options.brain, options.telephony.lang);
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

  let lastSpoken = '';

  /** Streaming path (ADR-032): transcode and ship frames as PCM arrives —
   * the caller hears the first word while the rest still renders. */
  const sayStreaming = async (text: string): Promise<void> => {
    let pcmCarry = Buffer.alloc(0);
    let ulawCarry = Buffer.alloc(0);
    await options.synthesizer.synthesizeStream!(text, (pcmChunk) => {
      const data = Buffer.concat([pcmCarry, pcmChunk]);
      // 3 input samples (6 bytes of PCM16 @24k) become 1 μ-law byte @8k.
      const usable = Math.floor(data.length / 6) * 6;
      pcmCarry = data.subarray(usable);
      if (usable === 0) {
        return;
      }
      const out = Buffer.concat([ulawCarry, pcm16ToUlaw8k(data.subarray(0, usable))]);
      const whole = Math.floor(out.length / 160) * 160;
      ulawCarry = out.subarray(whole);
      if (whole > 0) {
        sendFrames(out.subarray(0, whole));
      }
    });
    const tailPcm = pcmCarry.subarray(0, Math.floor(pcmCarry.length / 6) * 6);
    const tail = Buffer.concat([
      ulawCarry,
      tailPcm.length > 0 ? pcm16ToUlaw8k(tailPcm) : Buffer.alloc(0),
    ]);
    if (tail.length > 0) {
      sendFrames(tail);
    }
  };

  const say = async (text: string): Promise<void> => {
    lastSpoken = text;
    if (typeof options.synthesizer.synthesizeStream === 'function' && !options.mp3ToUlaw) {
      await sayStreaming(text);
      return;
    }
    const speech = await options.synthesizer.synthesize(text);
    if (speech.mimeType.startsWith('audio/pcm')) {
      sendFrames(pcm16ToUlaw8k(speech.audio));
      return;
    }
    if (speech.mimeType === 'audio/mpeg' && options.mp3ToUlaw) {
      sendFrames(await options.mp3ToUlaw(speech.audio));
      return;
    }
    throw new Error(`Telephony cannot voice ${speech.mimeType} without a transcoder (ADR-029).`);
  };

  const runTurn = (text: string): void => {
    turnChain = turnChain.then(async () => {
      try {
        // action.requested has no audio analog: the reply TEXT already
        // tells the caller honestly that the request awaits approval
        // (ADR-013) — the brain's words are the phone UI.
        const brainStart = Date.now();
        const result = await engine.userTurn(text);
        const brainMs = Date.now() - brainStart;
        const ttsStart = Date.now();
        await say(result.reply);
        // Latency is a product feature on a phone call: keep the
        // breakdown in the logs so regressions are diagnosable.
        log(`phone turn timing: brain=${brainMs}ms tts=${Date.now() - ttsStart}ms`);
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
                  // Transcript TEXT in logs is within the ADR-025 boundary
                  // (audio never is) — and it is the only way to diagnose
                  // language drift with data instead of ears.
                  log(`phone turn heard: "${text.slice(0, 120)}"`);
                  if (text.length === 0) {
                    return;
                  }
                  // Echo guard (ADR-032): the line transcribed OUR OWN
                  // greeting as caller speech on a live call — anything we
                  // just said never becomes a turn.
                  const heard = normalizeForEcho(text);
                  if (heard.length >= 8 && normalizeForEcho(lastSpoken).includes(heard)) {
                    log('phone turn dropped as echo of the agent voice');
                    return;
                  }
                  runTurn(text);
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
