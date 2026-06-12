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
import type { CallCapacity } from './call-capacity.js';
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
  /** Cost guard (ADR-034); the TwiML door consults it, the bridge accounts. */
  readonly capacity?: CallCapacity;
  /** Per-tenant identities keyed by client key (ADR-035); a matching key
   * selects that tenant's API client, greeting and language. Absent or no
   * match → the single-tenant default below. */
  readonly routes?: ReadonlyMap<string, CallIdentity>;
  /** Dialed-number (digits only) → client key, for the /twiml resolver. */
  readonly phoneToKey?: ReadonlyMap<string, string>;
  readonly telephony: TelephonyConfig;
  readonly log?: (message: string) => void;
}

/** Digits-only form so +34 91…, 0034 91… and 91… all compare equal. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** What a call needs to belong to the right tenant (ADR-035). */
export interface CallIdentity {
  readonly api: AurionApiPort;
  readonly greeting: string;
  readonly lang: string;
}

const APOLOGY = 'Disculpa, ha habido un problema técnico. ¿Puedes repetirlo?';

/** Short, language-matched fillers for a slow turn (ADR-038). They keep the
 * line alive while the brain works; they are never an answer and never an
 * action — the reply text always follows. */
const BACKCHANNELS: Readonly<Record<string, string>> = {
  es: 'Un momento, lo reviso.',
  en: 'One moment, let me check.',
  pt: 'Um momento, vou verificar.',
};

function pickBackchannel(lang: string): string {
  return BACKCHANNELS[lang.slice(0, 2).toLowerCase()] ?? BACKCHANNELS.es;
}

/** A cancelable timeout: resolves `true` if it fires, never throws, and is
 * cleared as soon as the turn wins the race so no timer dangles. */
function fillerTimer(ms: number): { fired: Promise<boolean>; cancel: () => void } {
  let handle: ReturnType<typeof setTimeout>;
  const fired = new Promise<boolean>((resolve) => {
    handle = setTimeout(() => resolve(true), ms);
  });
  return { fired, cancel: () => clearTimeout(handle) };
}

/** The greeting never changes per process: synthesize ONCE, replay
 * instantly on every call (ADR-029 tuning — buffered voices like the
 * operator clone cost seconds per synthesis). Keyed by the synthesizer
 * instance (stable per process; per-connection options are spread). */
const GREETING_CACHE = new WeakMap<SpeechSynthesisPort, { text: string; ulaw: Buffer }>();

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
  // Identity is resolved at `start` from the call's key (ADR-035); until
  // then it is the single-tenant default. The phone line's language pins
  // the brain's reply language (a caller greeted in Portuguese once).
  let identity: CallIdentity = {
    api: options.api,
    greeting: options.telephony.greeting,
    lang: options.telephony.lang,
  };
  let engine: ConversationEngine | null = null;
  let streamSid: string | null = null;
  let stream: UtteranceStream | null = null;
  let endedGracefully = false;
  let counted = false;
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
  const sayStreaming = async (text: string, out: (ulaw: Buffer) => void): Promise<void> => {
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
      const ulaw = Buffer.concat([ulawCarry, pcm16ToUlaw8k(data.subarray(0, usable))]);
      const whole = Math.floor(ulaw.length / 160) * 160;
      ulawCarry = ulaw.subarray(whole);
      if (whole > 0) {
        out(ulaw.subarray(0, whole));
      }
    });
    const tailPcm = pcmCarry.subarray(0, Math.floor(pcmCarry.length / 6) * 6);
    const tail = Buffer.concat([
      ulawCarry,
      tailPcm.length > 0 ? pcm16ToUlaw8k(tailPcm) : Buffer.alloc(0),
    ]);
    if (tail.length > 0) {
      out(tail);
    }
  };

  const say = async (text: string): Promise<void> => {
    lastSpoken = text;
    const isGreeting = text === identity.greeting;
    const cached = isGreeting ? GREETING_CACHE.get(options.synthesizer) : undefined;
    if (cached && cached.text === text) {
      sendFrames(cached.ulaw);
      return;
    }
    const collected: Buffer[] = [];
    const out = (ulaw: Buffer): void => {
      if (isGreeting) {
        collected.push(ulaw);
      }
      sendFrames(ulaw);
    };
    if (typeof options.synthesizer.synthesizeStream === 'function' && !options.mp3ToUlaw) {
      await sayStreaming(text, out);
    } else {
      const speech = await options.synthesizer.synthesize(text);
      if (speech.mimeType.startsWith('audio/pcm')) {
        out(pcm16ToUlaw8k(speech.audio));
      } else if (speech.mimeType === 'audio/mpeg' && options.mp3ToUlaw) {
        out(await options.mp3ToUlaw(speech.audio));
      } else {
        throw new Error(`Telephony cannot voice ${speech.mimeType} without a transcoder (ADR-029).`);
      }
    }
    if (isGreeting && collected.length > 0) {
      GREETING_CACHE.set(options.synthesizer, { text, ulaw: Buffer.concat(collected) });
    }
  };

  const runTurn = (text: string): void => {
    turnChain = turnChain.then(async () => {
      try {
        // action.requested has no audio analog: the reply TEXT already
        // tells the caller honestly that the request awaits approval
        // (ADR-013) — the brain's words are the phone UI.
        const brainStart = Date.now();
        const turnPromise = engine!.userTurn(text);
        // Backchannel (ADR-038): a slow brain leaves dead air on the line.
        // If the answer is not ready within the window, speak a short
        // language-matched filler so the caller knows we are working — the
        // reply TEXT still follows and stays the source of truth.
        let filled = false;
        if (options.telephony.backchannelMs > 0) {
          const timer = fillerTimer(options.telephony.backchannelMs);
          const ready = await Promise.race([
            turnPromise.then(
              () => true,
              () => true,
            ),
            timer.fired.then(() => false),
          ]);
          timer.cancel();
          if (!ready) {
            filled = true;
            await say(pickBackchannel(identity.lang));
          }
        }
        const result = await turnPromise;
        const brainMs = Date.now() - brainStart;
        const ttsStart = Date.now();
        await say(result.reply);
        // Latency is a product feature on a phone call: keep the
        // breakdown in the logs so regressions are diagnosable.
        log(
          `phone turn timing: brain=${brainMs}ms tts=${Date.now() - ttsStart}ms` +
            (filled ? ' backchannel=yes' : ''),
        );
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
            // carry <Parameter name="key"> matching a configured key —
            // a per-tenant route key (ADR-035) or the single-tenant key.
            const route = event.key ? options.routes?.get(event.key) : undefined;
            if (!event.key || (!route && !options.clientKeys.includes(event.key))) {
              socket.close(4401, 'Missing or invalid client key.');
              return;
            }
            if (route) {
              identity = route;
            }
            engine = new ConversationEngine(identity.api, options.brain, identity.lang);
            streamSid = event.streamSid;
            if (options.capacity && !counted) {
              counted = true;
              options.capacity.begin();
            }
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
              identity.lang,
            );
            await say(identity.greeting);
            break;
          }
          case 'media': {
            stream?.push(Buffer.from(event.payload, 'base64'));
            break;
          }
          case 'stop': {
            if (engine && engine.isStarted && !engine.isClosed) {
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
    if (counted) {
      options.capacity?.end();
    }
    // An abrupt drop with a live session is recorded as `failed` —
    // silence is never an outcome (ADR-018), by phone either.
    if (engine && engine.isStarted && !engine.isClosed && !endedGracefully) {
      void engine.abort('connection_dropped');
    }
  });
}
