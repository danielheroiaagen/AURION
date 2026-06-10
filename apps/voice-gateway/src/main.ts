import { loadGatewayConfig } from './config.js';
import { AurionApiClient } from './infrastructure/aurion-api.client.js';
import { LlmBrain } from './infrastructure/llm-brain.js';
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
});
