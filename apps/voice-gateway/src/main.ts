import { loadGatewayConfig } from './config.js';
import { AurionApiClient } from './infrastructure/aurion-api.client.js';
import { HeyGenSpeechSynthesizer } from './infrastructure/heygen-speech.js';
import { LlmBrain } from './infrastructure/llm-brain.js';
import { ffmpegAvailable, mp3ToUlaw8k } from './infrastructure/mp3-ulaw.js';
import { OidcTokenProvider } from './infrastructure/oidc-token-provider.js';
import { OpenAiSpeechSynthesizer } from './infrastructure/openai-speech.js';
import { OpenAiTranscriber } from './infrastructure/openai-transcriber.js';
import { OpenAiRealtimeTranscriber } from './infrastructure/realtime-transcriber.js';
import { ScriptedBrain } from './infrastructure/scripted-brain.js';
import { phoneDigits, type CallIdentity } from './infrastructure/twilio-bridge.js';
import { startWsServer } from './infrastructure/ws-server.js';

// Fail closed: this throws before any socket opens if the config is incomplete.
const config = loadGatewayConfig();

// Machine identity: real-IdP client_credentials when configured (ADR-033),
// the static dev token otherwise — validated fail-closed at load time.
const tokenSource = config.oidc
  ? ((provider) => provider.getToken.bind(provider))(new OidcTokenProvider(config.oidc))
  : config.voiceAgentToken!;
const api = new AurionApiClient(config.apiUrl, tokenSource);
// BRAIN_MODE is validated fail-closed at load time (ADR-018/ADR-022).
const brain = config.brainMode === 'llm' ? new LlmBrain(config.llm!) : new ScriptedBrain();

// TTS_MODE (ADR-026/ADR-029); off means replies stay text-only.
const synthesizer =
  config.ttsMode === 'heygen'
    ? new HeyGenSpeechSynthesizer(config.tts!)
    : config.ttsMode === 'openai'
      ? new OpenAiSpeechSynthesizer(config.tts!)
      : null;

if (config.telephonyMode === 'twilio' && config.ttsMode === 'heygen' && !ffmpegAvailable()) {
  // A phone gateway that cannot voice its replies does not answer (ADR-029).
  throw new Error('TELEPHONY_MODE=twilio with heygen TTS requires the ffmpeg binary (ADR-029).');
}

// Per-tenant telephony routes (ADR-035): each route gets its OWN machine
// identity (its tenant_id is in the minted token) and API client — the
// isolation is the same RLS as everywhere, just a different actor.
const routesByKey = new Map<string, CallIdentity>();
const phoneToKey = new Map<string, string>();
for (const route of config.telephony?.routes ?? []) {
  const tenantApi = new AurionApiClient(
    config.apiUrl,
    ((provider) => provider.getToken.bind(provider))(new OidcTokenProvider(route.oidc)),
  );
  routesByKey.set(route.clientKey, {
    api: tenantApi,
    greeting: route.greeting,
    lang: route.lang,
    // Per-tenant brand voice (ADR-038); empty → the gateway default voice.
    voice: route.voice || undefined,
  });
  phoneToKey.set(phoneDigits(route.phone), route.clientKey);
}
const allClientKeys = [...config.clientKeys, ...routesByKey.keys()];

startWsServer({
  port: config.port,
  clientKeys: config.clientKeys,
  api,
  brain,
  // STT_MODE likewise (ADR-025); off means audio.utterance answers stt_disabled.
  transcriber: config.sttMode === 'openai' ? new OpenAiTranscriber(config.stt!) : null,
  synthesizer,
  // TELEPHONY_MODE (ADR-027) is validated to require both STT and TTS.
  twilio:
    config.telephonyMode === 'twilio'
      ? {
          clientKeys: allClientKeys,
          routes: routesByKey,
          phoneToKey,
          api,
          brain,
          // The greeting doubles as the transcription's context bias: the
          // literal first words of the call, in the channel language.
          // TELEPHONY_STT_MODEL (ADR-032) can pick a streaming-first model
          // (gpt-realtime-whisper) without touching the widget's REST STT.
          transcriber: new OpenAiRealtimeTranscriber(
            {
              ...config.stt!,
              model: config.telephony!.sttModel || config.stt!.model,
            },
            config.telephony!.silenceMs,
            config.telephony!.greeting,
          ),
          // HeyGen speaks MP3 and is decoded by ffmpeg; OpenAI speaks PCM natively.
          synthesizer:
            config.ttsMode === 'heygen'
              ? new HeyGenSpeechSynthesizer(config.tts!)
              : new OpenAiSpeechSynthesizer(config.tts!, fetch, 'pcm'),
          mp3ToUlaw: config.ttsMode === 'heygen' ? (mp3) => mp3ToUlaw8k(mp3) : null,
          telephony: config.telephony!,
        }
      : null,
  maxAudioBytes: config.stt?.maxAudioBytes,
});
