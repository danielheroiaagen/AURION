import { ConnectorRegistry } from './application/connector.port.js';
import { loadReceiverConfig } from './config.js';
import { startReceiver } from './infrastructure/http-server.js';
import { StubCalendarConnector, StubTicketConnector } from './infrastructure/stub-connectors.js';

// Fail closed: this throws before the server opens if the secret is missing.
const config = loadReceiverConfig();

const registry = new ConnectorRegistry();
registry.register(new StubTicketConnector());
registry.register(new StubCalendarConnector());

startReceiver(config, registry);
