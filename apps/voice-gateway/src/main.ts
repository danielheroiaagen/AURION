import { loadGatewayConfig } from './config.js';
import { AurionApiClient } from './infrastructure/aurion-api.client.js';
import { ScriptedBrain } from './infrastructure/scripted-brain.js';
import { startWsServer } from './infrastructure/ws-server.js';

// Fail closed: this throws before any socket opens if the config is incomplete.
const config = loadGatewayConfig();

startWsServer({
  port: config.port,
  clientKeys: config.clientKeys,
  api: new AurionApiClient(config.apiUrl, config.voiceAgentToken),
  // BRAIN_MODE is validated at load time; `scripted` is the only mode today.
  brain: new ScriptedBrain(),
});
