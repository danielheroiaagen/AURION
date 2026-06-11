import type { N8nConfig } from '../config.js';
import { ConnectorError, type ConnectorPort } from '../application/connector.port.js';

/**
 * n8n-backed connector (ADR-030): the action executes as an n8n WORKFLOW
 * on the operator's own n8n instance — credentials for calendar, email,
 * tickets and WhatsApp live in n8n, never in AURION. One webhook per
 * action type: `<base>/aurion-<action_type>`.
 *
 * The workflow's JSON response becomes the evidence AURION records
 * (stamped `connector_mode: "n8n"`); a non-JSON or failing workflow is a
 * ConnectorError — the dispatch reports `connector_failed`, never a
 * fabricated success.
 */
export class N8nConnector implements ConnectorPort {
  constructor(
    readonly actionType: string,
    private readonly config: N8nConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async execute(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let evidence: unknown;
    try {
      const response = await this.fetchImpl(
        `${this.config.webhookBase}/aurion-${this.actionType}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.config.secret ? { 'x-aurion-secret': this.config.secret } : {}),
          },
          body: JSON.stringify({ action_type: this.actionType, payload }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new ConnectorError(`n8n workflow responded ${response.status}.`);
      }
      evidence = await response.json().catch(() => {
        throw new ConnectorError('n8n workflow returned non-JSON evidence.');
      });
    } catch (error) {
      if (error instanceof ConnectorError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ConnectorError(
          `n8n workflow did not respond within ${this.config.timeoutMs}ms.`,
        );
      }
      throw new ConnectorError('n8n could not be reached.');
    } finally {
      clearTimeout(timer);
    }

    const result =
      evidence !== null && typeof evidence === 'object' && !Array.isArray(evidence)
        ? (evidence as Record<string, unknown>)
        : { workflow_response: evidence };
    return { ...result, connector_mode: 'n8n', workflow: `aurion-${this.actionType}` };
  }
}
