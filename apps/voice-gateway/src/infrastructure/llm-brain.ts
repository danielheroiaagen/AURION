import type { LlmConfig } from '../config.js';
import type { AgentBrainPort, BrainContext, BrainReply, ToolIntent } from '../application/ports.js';

/**
 * OpenAI-compatible Chat Completions brain (ADR-022). Plain fetch — no SDK.
 *
 * Safety mapping: the model is offered exactly the catalog tools; a tool
 * call becomes a ToolIntent and flows into the SAME approval-gated action
 * path as every other intent (the gateway has no execute path, ADR-018).
 * Unknown tools are dropped conversationally — the model cannot mint
 * capabilities. Upstream failures raise BrainError, which the WS layer
 * reports as `upstream_failed`; an outage never fabricates a reply.
 *
 * Privacy boundary: transcript text + knowledge TITLES only.
 */
export class BrainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrainError';
  }
}

/** Mirror of the API's ACTION_TYPES catalog (ADR-013). */
const TOOL_CATALOG = [
  {
    type: 'function' as const,
    function: {
      name: 'ticket.create',
      description:
        'Register a support ticket request for the caller. It will be executed only after a human approves it.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Short summary of the caller issue.' },
        },
        required: ['subject'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calendar.update',
      description:
        'Register an appointment change request for the caller. It will be executed only after a human approves it.',
      parameters: {
        type: 'object',
        properties: {
          request: { type: 'string', description: 'What the caller wants changed.' },
        },
        required: ['request'],
      },
    },
  },
];

const KNOWN_TOOLS = new Set(TOOL_CATALOG.map((tool) => tool.function.name));

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

export class LlmBrain implements AgentBrainPort {
  constructor(
    private readonly config: LlmConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async respond(context: BrainContext): Promise<BrainReply> {
    const messages = [
      {
        role: 'system',
        content:
          'You are AURION, a voice support agent for one company. Answer briefly and naturally, in the caller language. ' +
          'You may use the provided tools to REGISTER requests; be honest that registered requests run only after a human approves them — never claim something was already done. ' +
          (context.knowledge.length > 0
            ? `The company knowledge base covers: ${context.knowledge.join(', ')}.`
            : 'No knowledge base is published yet.'),
      },
      ...context.transcript.map((turn) => ({
        role: turn.speaker === 'caller' ? 'user' : 'assistant',
        content: turn.text,
      })),
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let parsed: ChatCompletionResponse;
    try {
      const response = await this.fetchImpl(`${this.config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          messages,
          tools: TOOL_CATALOG,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BrainError(`Model endpoint responded ${response.status}.`);
      }
      parsed = (await response.json()) as ChatCompletionResponse;
    } catch (error) {
      if (error instanceof BrainError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BrainError(`Model did not respond within ${this.config.timeoutMs}ms.`);
      }
      throw new BrainError('Model endpoint could not be reached.');
    } finally {
      clearTimeout(timer);
    }

    const message = parsed.choices?.[0]?.message;
    if (!message) {
      throw new BrainError('Model returned no message.');
    }

    const toolIntent = this.extractIntent(message.tool_calls);
    const text =
      typeof message.content === 'string' && message.content.trim().length > 0
        ? message.content.trim()
        : toolIntent
          ? 'I have registered your request; it will run once a human approves it.'
          : 'Could you tell me a bit more about what you need?';

    return { text, toolIntent };
  }

  /** First KNOWN tool call wins; unknown tools and bad arguments are dropped. */
  private extractIntent(
    toolCalls: Array<{ function?: { name?: string; arguments?: string } }> | undefined,
  ): ToolIntent | null {
    for (const call of toolCalls ?? []) {
      const name = call.function?.name;
      if (!name || !KNOWN_TOOLS.has(name)) {
        continue;
      }
      let payload: Record<string, unknown> = {};
      try {
        const args = JSON.parse(call.function?.arguments ?? '{}');
        if (args && typeof args === 'object' && !Array.isArray(args)) {
          payload = args as Record<string, unknown>;
        }
      } catch {
        // Malformed arguments: register the intent with an empty payload
        // rather than dropping the caller's request silently.
      }
      return { actionType: name, payload: { ...payload, channel: 'voice' } };
    }
    return null;
  }
}
