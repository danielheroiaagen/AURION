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
  /** Backchannel window (ADR-038): speak a short filler when the brain has
   * not answered within this many ms; 0 disables. The reply text still
   * follows and stays the source of truth. */
  readonly backchannelMs: number;
  /** Per-number tenant routes (ADR-035); empty = single-tenant. */
  readonly routes: readonly TenantRoute[];
}

export interface OidcMachineConfig {
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly audience: string | null;
  readonly timeoutMs: number;
}

/**
 * One telephony tenant route (ADR-035): a dialed number bound to a tenant's
 * own machine identity, client key and greeting. Isolation is the SAME as
 * everywhere else — each route mints its tenant's OIDC token, and the API's
 * RLS does the rest. Absent routes = single-tenant (today's behavior).
 */
export interface TenantRoute {
  /** The dialed number (E.164) that selects this tenant. */
  readonly phone: string;
  /** Unique client key carried in the TwiML <Parameter>; identifies the route. */
  readonly clientKey: string;
  readonly greeting: string;
  readonly lang: string;
  /** Tenant's own brand voice (ADR-038 Audio Pro); empty → the gateway's
   * default TTS_VOICE. A provider voice id (OpenAI name or HeyGen voice_id). */
  readonly voice: string;
  /** Tenant's own client_credentials identity (its tenant_id is in the token). */
  readonly oidc: OidcMachineConfig;
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

/** Like parsePositiveInt but admits 0 (an explicit "disabled"); only a
 * negative or unparseable value falls back. */
function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Parse TELEPHONY_TENANT_ROUTES (ADR-035): a JSON array of
 * { phone, clientKey, greeting, lang?, voice?, oidcClientId,
 *   oidcClientSecret, oidcTokenUrl? }. `voice` is the tenant's brand voice
 *   (ADR-038); empty → the gateway default. Fail-closed: malformed JSON or
 *   an incomplete route
 * aborts boot — a misconfigured tenant must never silently fall back to
 * another tenant's identity. The token URL defaults to the gateway's own
 * OIDC token URL (the same realm).
 */
function parseTenantRoutes(
  raw: string | undefined,
  baseOidc: OidcMachineConfig | null,
): TenantRoute[] {
  const text = (raw ?? '').trim();
  if (!text) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('TELEPHONY_TENANT_ROUTES must be valid JSON (ADR-035).');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('TELEPHONY_TENANT_ROUTES must be a JSON array (ADR-035).');
  }
  const seenKeys = new Set<string>();
  const seenPhones = new Set<string>();
  return parsed.map((entry, index) => {
    const route = entry as Record<string, unknown>;
    const phone = typeof route.phone === 'string' ? route.phone.trim() : '';
    const clientKey = typeof route.clientKey === 'string' ? route.clientKey.trim() : '';
    const clientId = typeof route.oidcClientId === 'string' ? route.oidcClientId.trim() : '';
    const clientSecret = typeof route.oidcClientSecret === 'string' ? route.oidcClientSecret : '';
    if (!/^\+?[0-9]{6,15}$/.test(phone)) {
      throw new Error(`TELEPHONY_TENANT_ROUTES[${index}].phone must be an E.164 number.`);
    }
    if (clientKey.length < 16) {
      throw new Error(`TELEPHONY_TENANT_ROUTES[${index}].clientKey must be 16+ characters.`);
    }
    if (!clientId || clientSecret.length < 8) {
      throw new Error(
        `TELEPHONY_TENANT_ROUTES[${index}] requires oidcClientId and oidcClientSecret (ADR-035).`,
      );
    }
    const tokenUrl =
      (typeof route.oidcTokenUrl === 'string' ? route.oidcTokenUrl.trim() : '') ||
      baseOidc?.tokenUrl;
    if (!tokenUrl || !/^https?:\/\//.test(tokenUrl)) {
      throw new Error(
        `TELEPHONY_TENANT_ROUTES[${index}] needs an https oidcTokenUrl (or a global OIDC_TOKEN_URL).`,
      );
    }
    if (seenKeys.has(clientKey) || seenPhones.has(phone)) {
      throw new Error(`TELEPHONY_TENANT_ROUTES has a duplicate phone or clientKey at [${index}].`);
    }
    seenKeys.add(clientKey);
    seenPhones.add(phone);
    return {
      phone,
      clientKey,
      greeting:
        (typeof route.greeting === 'string' ? route.greeting.trim() : '') ||
        'Hola, soy un asistente virtual de inteligencia artificial. ¿En qué puedo ayudarte?',
      lang: (typeof route.lang === 'string' ? route.lang.trim() : '') || 'es-ES',
      voice: typeof route.voice === 'string' ? route.voice.trim() : '',
      oidc: {
        tokenUrl: tokenUrl.replace(/\/+$/, ''),
        clientId,
        clientSecret,
        audience: baseOidc?.audience ?? null,
        timeoutMs: baseOidc?.timeoutMs ?? 10_000,
      },
    };
  });
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
      backchannelMs: parseNonNegativeInt(env.TELEPHONY_BACKCHANNEL_MS, 1500),
      routes: parseTenantRoutes(env.TELEPHONY_TENANT_ROUTES, oidc),
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
