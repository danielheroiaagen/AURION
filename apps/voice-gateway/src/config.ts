/**
 * Voice gateway configuration (ADR-018), read once at startup. Fail closed:
 * the gateway refuses to boot without its API endpoint, its machine token,
 * at least one client connection key, and a known brain mode.
 */
export type BrainMode = 'scripted';

export interface GatewayConfig {
  readonly port: number;
  readonly apiUrl: string;
  readonly voiceAgentToken: string;
  readonly clientKeys: readonly string[];
  readonly brainMode: BrainMode;
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
  if (brainMode !== 'scripted') {
    throw new Error(`BRAIN_MODE "${brainMode}" is unknown; supported: scripted.`);
  }

  return {
    port: parsePositiveInt(env.PORT, 8080),
    apiUrl: apiUrl.replace(/\/+$/, ''),
    voiceAgentToken,
    clientKeys,
    brainMode,
  };
}
