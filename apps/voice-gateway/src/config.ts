/**
 * Voice gateway configuration (ADR-018/ADR-022/ADR-025/ADR-026), read once
 * at startup. Fail closed: the gateway refuses to boot without its API
 * endpoint, its machine token, at least one client connection key, and a
 * complete configuration for the selected brain, STT, and TTS modes.
 */
export type BrainMode = 'scripted' | 'llm';
export type SttMode = 'off' | 'openai';
export type TtsMode = 'off' | 'openai';
export type TelephonyMode = 'off' | 'twilio';

export interface LlmConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxTokens: number;
}

export interface SttConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxAudioBytes: number;
}

export interface TtsConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly voice: string;
  readonly timeoutMs: number;
  readonly maxTextChars: number;
}

export interface TelephonyConfig {
  readonly greeting: string;
  readonly lang: string;
  readonly silenceMs: number;
}

export interface GatewayConfig {
  readonly port: number;
  readonly apiUrl: string;
  readonly voiceAgentToken: string;
  readonly clientKeys: readonly string[];
  readonly brainMode: BrainMode;
  readonly llm: LlmConfig | null;
  readonly sttMode: SttMode;
  readonly stt: SttConfig | null;
  readonly ttsMode: TtsMode;
  readonly tts: TtsConfig | null;
  readonly telephonyMode: TelephonyMode;
  readonly telephony: TelephonyConfig | null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const apiUrl = env.AURION_API_URL;
  if (!apiUrl || !/^https?:\/\//.test(apiUrl)) {
    throw new Error('AURION_API_URL is required (http(s) URL of the AURION API).');
  }

  const voiceAgentToken = env.VOICE_AGENT_TOKEN;
  if (!voiceAgentToken || voiceAgentToken.split('.').length !== 3) {
    throw new Error(
      'VOICE_AGENT_TOKEN is required and must be a JWT for a voice_agent actor (ADR-018).',
    );
  }

  const clientKeys = (env.VOICE_GATEWAY_CLIENT_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length >= 16);
  if (clientKeys.length === 0) {
    throw new Error(
      'VOICE_GATEWAY_CLIENT_KEYS is required: at least one comma-separated key of 16+ characters. Unauthenticated gateways are not a mode.',
    );
  }

  const brainMode = (env.BRAIN_MODE ?? 'scripted').trim();
  if (brainMode !== 'scripted' && brainMode !== 'llm') {
    throw new Error(`BRAIN_MODE "${brainMode}" is unknown; supported: scripted, llm.`);
  }

  let llm: LlmConfig | null = null;
  if (brainMode === 'llm') {
    const llmUrl = env.LLM_API_URL;
    if (!llmUrl || !/^https?:\/\//.test(llmUrl)) {
      throw new Error('LLM_API_URL is required in llm mode (ADR-022).');
    }
    const apiKey = env.LLM_API_KEY;
    if (!apiKey || apiKey.length < 8) {
      throw new Error('LLM_API_KEY is required in llm mode (ADR-022).');
    }
    const model = env.LLM_MODEL;
    if (!model) {
      throw new Error('LLM_MODEL is required in llm mode (ADR-022).');
    }
    llm = {
      apiUrl: llmUrl.replace(/\/+$/, ''),
      apiKey,
      model,
      timeoutMs: parsePositiveInt(env.LLM_TIMEOUT_MS, 30_000),
      maxTokens: parsePositiveInt(env.LLM_MAX_TOKENS, 300),
    };
  }

  const sttMode = (env.STT_MODE ?? 'off').trim();
  if (sttMode !== 'off' && sttMode !== 'openai') {
    throw new Error(`STT_MODE "${sttMode}" is unknown; supported: off, openai.`);
  }

  let stt: SttConfig | null = null;
  if (sttMode === 'openai') {
    const apiKey = env.STT_API_KEY;
    if (!apiKey || apiKey.length < 8) {
      throw new Error('STT_API_KEY is required in openai STT mode (ADR-025).');
    }
    const sttUrl = (env.STT_API_URL ?? 'https://api.openai.com/v1').trim();
    if (!/^https?:\/\//.test(sttUrl)) {
      throw new Error('STT_API_URL must be an http(s) URL (ADR-025).');
    }
    stt = {
      apiUrl: sttUrl.replace(/\/+$/, ''),
      apiKey,
      model: (env.STT_MODEL ?? 'gpt-4o-transcribe').trim(),
      timeoutMs: parsePositiveInt(env.STT_TIMEOUT_MS, 30_000),
      maxAudioBytes: parsePositiveInt(env.STT_MAX_AUDIO_BYTES, 2_000_000),
    };
  }

  const ttsMode = (env.TTS_MODE ?? 'off').trim();
  if (ttsMode !== 'off' && ttsMode !== 'openai') {
    throw new Error(`TTS_MODE "${ttsMode}" is unknown; supported: off, openai.`);
  }

  let tts: TtsConfig | null = null;
  if (ttsMode === 'openai') {
    const apiKey = env.TTS_API_KEY;
    if (!apiKey || apiKey.length < 8) {
      throw new Error('TTS_API_KEY is required in openai TTS mode (ADR-026).');
    }
    const ttsUrl = (env.TTS_API_URL ?? 'https://api.openai.com/v1').trim();
    if (!/^https?:\/\//.test(ttsUrl)) {
      throw new Error('TTS_API_URL must be an http(s) URL (ADR-026).');
    }
    tts = {
      apiUrl: ttsUrl.replace(/\/+$/, ''),
      apiKey,
      model: (env.TTS_MODEL ?? 'gpt-4o-mini-tts').trim(),
      voice: (env.TTS_VOICE ?? 'alloy').trim(),
      timeoutMs: parsePositiveInt(env.TTS_TIMEOUT_MS, 30_000),
      maxTextChars: parsePositiveInt(env.TTS_MAX_TEXT_CHARS, 1_000),
    };
  }

  const telephonyMode = (env.TELEPHONY_MODE ?? 'off').trim();
  if (telephonyMode !== 'off' && telephonyMode !== 'twilio') {
    throw new Error(`TELEPHONY_MODE "${telephonyMode}" is unknown; supported: off, twilio.`);
  }

  let telephony: TelephonyConfig | null = null;
  if (telephonyMode === 'twilio') {
    // A phone call has no text fallback: a gateway that cannot both hear
    // and speak must not answer phones (ADR-027).
    if (sttMode !== 'openai' || ttsMode !== 'openai') {
      throw new Error(
        'TELEPHONY_MODE=twilio requires STT_MODE=openai and TTS_MODE=openai (ADR-027).',
      );
    }
    telephony = {
      greeting:
        (env.PHONE_GREETING ?? '').trim() ||
        'Hola, soy el asistente virtual. ¿En qué puedo ayudarte?',
      lang: (env.PHONE_LANG ?? 'es-ES').trim(),
      silenceMs: parsePositiveInt(env.TELEPHONY_SILENCE_MS, 600),
    };
  }

  return {
    port: parsePositiveInt(env.PORT, 8080),
    apiUrl: apiUrl.replace(/\/+$/, ''),
    voiceAgentToken,
    clientKeys,
    brainMode,
    llm,
    sttMode,
    stt,
    ttsMode,
    tts,
    telephonyMode,
    telephony,
  };
}
