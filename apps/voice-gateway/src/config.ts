/**
 * Voice gateway configuration (ADR-018/ADR-022), read once at startup.
 * Fail closed: the gateway refuses to boot without its API endpoint, its
 * machine token, at least one client connection key, and a complete
 * configuration for the selected brain mode.
 */
export type BrainMode = 'scripted' | 'llm';

export interface LlmConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxTokens: number;
}

export interface GatewayConfig {
  readonly port: number;
  readonly apiUrl: string;
  readonly voiceAgentToken: string;
  readonly clientKeys: readonly string[];
  readonly brainMode: BrainMode;
  readonly llm: LlmConfig | null;
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

  return {
    port: parsePositiveInt(env.PORT, 8080),
    apiUrl: apiUrl.replace(/\/+$/, ''),
    voiceAgentToken,
    clientKeys,
    brainMode,
    llm,
  };
}
