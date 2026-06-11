/**
 * Voice gateway configuration (ADR-018/ADR-022/ADR-025/ADR-026), read once
 * at startup. Fail closed: the gateway refuses to boot without its API
 * endpoint, its machine token, at least one client connection key, and a
 * complete configuration for the selected brain, STT, and TTS modes.
 */
export type BrainMode = 'scripted' | 'llm';
export type SttMode = 'off' | 'openai';
export type TtsMode = 'off' | 'openai' | 'heygen';
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
  /** Speaking pace 0.5–2.0 (1.15 wakes up a sleepy clone — tuned live). */
  readonly speed: number;
  /** Explicit synthesis language (ISO-639-1), empty = provider autodetect. */
  readonly lang: string;
}

export interface TelephonyConfig {
  readonly greeting: string;
  readonly lang: string;
  readonly silenceMs: number;
  /** Validates X-Twilio-Signature on /twiml (ADR-028). */
  readonly twilioAuthToken: string;
  /** The https origin Twilio reaches us at — pinned, never derived from headers. */
  readonly publicUrl: string;
  /** Streaming STT model for the call (ADR-032); empty → STT_MODEL. */
  readonly sttModel: string;
  /** Cost guards for paid traffic (ADR-034): simultaneous and daily caps. */
  readonly maxConcurrentCalls: number;
  readonly maxCallsPerDay: number;
}

export interface OidcMachineConfig {
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly audience: string | null;
  readonly timeoutMs: number;
}

export interface GatewayConfig {
  readonly port: number;
  readonly apiUrl: string;
  /** Static machine JWT (hs256 dev); null when a real IdP mints it (ADR-033). */
  readonly voiceAgentToken: string | null;
  /** client_credentials identity against the IdP; null in static mode. */
  readonly oidc: OidcMachineConfig | null;
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

  // Machine identity (ADR-018/ADR-033): EITHER a static JWT (hs256 dev)
  // OR client_credentials against a real IdP — never neither.
  let oidc: OidcMachineConfig | null = null;
  const oidcTokenUrl = (env.OIDC_TOKEN_URL ?? '').trim();
  if (oidcTokenUrl) {
    if (!/^https?:\/\//.test(oidcTokenUrl)) {
      throw new Error('OIDC_TOKEN_URL must be an http(s) URL (ADR-033).');
    }
    const clientId = (env.OIDC_CLIENT_ID ?? '').trim();
    const clientSecret = env.OIDC_CLIENT_SECRET ?? '';
    if (!clientId || clientSecret.length < 8) {
      throw new Error(
        'OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are required with OIDC_TOKEN_URL (ADR-033).',
      );
    }
    oidc = {
      tokenUrl: oidcTokenUrl.replace(/\/+$/, ''),
      clientId,
      clientSecret,
      audience: (env.OIDC_AUDIENCE ?? '').trim() || null,
      timeoutMs: parsePositiveInt(env.OIDC_TIMEOUT_MS, 10_000),
    };
  }

  const voiceAgentToken = (env.VOICE_AGENT_TOKEN ?? '').trim() || null;
  if (!oidc && (!voiceAgentToken || voiceAgentToken.split('.').length !== 3)) {
    throw new Error(
      'VOICE_AGENT_TOKEN (a JWT) or OIDC_TOKEN_URL (real IdP) is required for the voice_agent identity (ADR-018/ADR-033).',
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
    // NOTE: no reasoning_effort lever here. With function tools (which the
    // brain ALWAYS sends) gpt-5.4/5.5 reject it on /v1/chat/completions —
    // brain latency is governed by the MODEL choice (LLM_MODEL), measured
    // live: gpt-5.4-mini ≈ 0.9s vs gpt-5.5 ≈ 4s with identical payloads.
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
  if (ttsMode !== 'off' && ttsMode !== 'openai' && ttsMode !== 'heygen') {
    throw new Error(`TTS_MODE "${ttsMode}" is unknown; supported: off, openai, heygen.`);
  }

  let tts: TtsConfig | null = null;
  if (ttsMode !== 'off') {
    const apiKey = env.TTS_API_KEY;
    if (!apiKey || apiKey.length < 8) {
      throw new Error(`TTS_API_KEY is required in ${ttsMode} TTS mode (ADR-026/ADR-029).`);
    }
    const defaultUrl = ttsMode === 'heygen' ? 'https://api.heygen.com' : 'https://api.openai.com/v1';
    const ttsUrl = (env.TTS_API_URL ?? '').trim() || defaultUrl;
    if (!/^https?:\/\//.test(ttsUrl)) {
      throw new Error('TTS_API_URL must be an http(s) URL (ADR-026).');
    }
    const voice = (env.TTS_VOICE ?? '').trim() || (ttsMode === 'openai' ? 'alloy' : '');
    if (ttsMode === 'heygen' && !voice) {
      // The operator's cloned voice id — there is no sensible default.
      throw new Error('TTS_VOICE (the HeyGen voice id) is required in heygen TTS mode (ADR-029).');
    }
    const speed = Number.parseFloat(env.TTS_SPEED ?? '1');
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) {
      throw new Error('TTS_SPEED must be a number between 0.5 and 2.0 (ADR-029).');
    }
    tts = {
      apiUrl: ttsUrl.replace(/\/+$/, ''),
      apiKey,
      model: (env.TTS_MODEL ?? 'gpt-4o-mini-tts').trim(),
      voice,
      timeoutMs: parsePositiveInt(env.TTS_TIMEOUT_MS, 30_000),
      maxTextChars: parsePositiveInt(env.TTS_MAX_TEXT_CHARS, 1_000),
      speed,
      lang: (env.TTS_LANG ?? '').trim(),
    };
  }

  const telephonyMode = (env.TELEPHONY_MODE ?? 'off').trim();
  if (telephonyMode !== 'off' && telephonyMode !== 'twilio') {
    throw new Error(`TELEPHONY_MODE "${telephonyMode}" is unknown; supported: off, twilio.`);
  }

  let telephony: TelephonyConfig | null = null;
  if (telephonyMode === 'twilio') {
    // A phone call has no text fallback: a gateway that cannot both hear
    // and speak must not answer phones (ADR-027). Any speaking mode
    // qualifies — heygen replies are decoded by ffmpeg (ADR-029).
    if (sttMode !== 'openai' || ttsMode === 'off') {
      throw new Error(
        'TELEPHONY_MODE=twilio requires STT_MODE=openai and TTS_MODE=openai|heygen (ADR-027/ADR-029).',
      );
    }
    const twilioAuthToken = env.TWILIO_AUTH_TOKEN;
    if (!twilioAuthToken || twilioAuthToken.length < 16) {
      throw new Error('TWILIO_AUTH_TOKEN is required in twilio mode (ADR-028).');
    }
    const publicUrl = (env.TELEPHONY_PUBLIC_URL ?? '').trim();
    if (!/^https:\/\//.test(publicUrl)) {
      throw new Error(
        'TELEPHONY_PUBLIC_URL is required in twilio mode and must be https (ADR-028).',
      );
    }
    telephony = {
      greeting:
        (env.PHONE_GREETING ?? '').trim() ||
        'Hola, soy el asistente virtual. ¿En qué puedo ayudarte?',
      lang: (env.PHONE_LANG ?? 'es-ES').trim(),
      silenceMs: parsePositiveInt(env.TELEPHONY_SILENCE_MS, 600),
      twilioAuthToken,
      publicUrl: publicUrl.replace(/\/+$/, ''),
      sttModel: (env.TELEPHONY_STT_MODEL ?? '').trim(),
      maxConcurrentCalls: parsePositiveInt(env.TELEPHONY_MAX_CONCURRENT, 4),
      maxCallsPerDay: parsePositiveInt(env.TELEPHONY_MAX_CALLS_PER_DAY, 200),
    };
  }

  return {
    port: parsePositiveInt(env.PORT, 8080),
    apiUrl: apiUrl.replace(/\/+$/, ''),
    voiceAgentToken,
    oidc,
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
