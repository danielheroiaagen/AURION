import { ConnectorRegistry } from './application/connector.port.js';
import { loadReceiverConfig } from './config.js';
import { startReceiver } from './infrastructure/http-server.js';
import { N8nConnector } from './infrastructure/n8n-connector.js';
import {
  StubCalendarConnector,
  StubEmailConnector,
  StubLeadConnector,
  StubTicketConnector,
  StubWhatsappConnector,
} from './infrastructure/stub-connectors.js';

// Fail closed: this throws before the server opens if the secret is missing.
const config = loadReceiverConfig();

const ACTION_TYPES = [
  'ticket.create',
  'calendar.update',
  'email.send',
  'whatsapp.send',
  'lead.capture',
];

const registry = new ConnectorRegistry();
if (config.connectorMode === 'n8n') {
  // CONNECTOR_MODE=n8n (ADR-030): every action executes as a workflow on
  // the operator's n8n; credentials live there, never in AURION.
  for (const actionType of ACTION_TYPES) {
    registry.register(new N8nConnector(actionType, config.n8n!));
  }
} else {
  registry.register(new StubTicketConnector());
  registry.register(new StubCalendarConnector());
  registry.register(new StubEmailConnector());
  registry.register(new StubWhatsappConnector());
  registry.register(new StubLeadConnector());
}

startReceiver(config, registry);
