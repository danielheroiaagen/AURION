/**
 * Connector seam (ADR-019): one action_type, one connector. Real
 * calendar/ticketing integrations land here with their credentials held on
 * the HERMES side only (receiver contract rule).
 */
export class ConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectorError';
  }
}

export interface ConnectorPort {
  readonly actionType: string;
  /** Returns the JSON evidence AURION records (encrypted at rest). */
  execute(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export class ConnectorRegistry {
  private readonly connectors = new Map<string, ConnectorPort>();

  register(connector: ConnectorPort): void {
    this.connectors.set(connector.actionType, connector);
  }

  find(actionType: string): ConnectorPort | null {
    return this.connectors.get(actionType) ?? null;
  }
}
