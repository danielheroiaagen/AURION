import { loadGatewayConfig } from './config.js';
import { AurionApiClient } from './infrastructure/aurion-api.client.js';
import { HeyGenSpeechSynthesizer } from './infrastructure/heygen-speech.js';
import { LlmBrain } from './infrastructure/llm-brain.js';
import { ffmpegAvailable, mp3ToUlaw8k } from './infrastructure/mp3-ulaw.js';
import { OpenAiSpeechSynthesizer } from './infrastructure/openai-speech.js';
import { OpenAiTranscriber } from './infrastructure/openai-transcriber.js';
import { OpenAiRealtimeTranscriber } from './infrastructure/realtime-transcriber.js';
import { ScriptedBrain } from './infrastructure/scripted-brain.js';
import { startWsServer } from './infrastructure/ws-server.js';

// Fail closed: this throws before any socket opens if the config is incomplete.
const config = loadGatewayConfig();

const api = new AurionApiClient(config.apiUrl, config.voiceAgentToken);
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
          clientKeys: config.clientKeys,
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
