import { loadGatewayConfig } from './config.js';
import { AurionApiClient } from './infrastructure/aurion-api.client.js';
import { LlmBrain } from './infrastructure/llm-brain.js';
import { OpenAiSpeechSynthesizer } from './infrastructure/openai-speech.js';
import { OpenAiTranscriber } from './infrastructure/openai-transcriber.js';
import { ScriptedBrain } from './infrastructure/scripted-brain.js';
import { startWsServer } from './infrastructure/ws-server.js';

// Fail closed: this throws before any socket opens if the config is incomplete.
const config = loadGatewayConfig();

startWsServer({
  port: config.port,
  clientKeys: config.clientKeys,
  api: new AurionApiClient(config.apiUrl, config.voiceAgentToken),
  // BRAIN_MODE is validated fail-closed at load time (ADR-018/ADR-022).
  brain: config.brainMode === 'llm' ? new LlmBrain(config.llm!) : new ScriptedBrain(),
  // STT_MODE likewise (ADR-025); off means audio.utterance answers stt_disabled.
  transcriber: config.sttMode === 'openai' ? new OpenAiTranscriber(config.stt!) : null,
  // TTS_MODE likewise (ADR-026); off means replies stay text-only.
  synthesizer: config.ttsMode === 'openai' ? new OpenAiSpeechSynthesizer(config.tts!) : null,
  maxAudioBytes: config.stt?.maxAudioBytes,
});
