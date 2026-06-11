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
const TOOL_DEFINITIONS = [
  {
    actionType: 'ticket.create',
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
  {
    actionType: 'calendar.update',
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
  {
    actionType: 'email.send',
    description:
      'Register an email to be sent on behalf of the company (confirmation, follow-up, information the caller asked for). It will be sent only after a human approves it.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address, if the caller gave one.' },
        subject: { type: 'string', description: 'Short subject line.' },
        body: { type: 'string', description: 'The message to send.' },
      },
      required: ['subject', 'body'],
    },
  },
  {
    actionType: 'whatsapp.send',
    description:
      'Register a WhatsApp message to be sent to the caller or a contact they specify. It will be sent only after a human approves it.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Destination phone in international format, if the caller gave one.',
        },
        message: { type: 'string', description: 'The message to send.' },
      },
      required: ['message'],
    },
  },
];

/** GPT-5-era models enforce `^[a-zA-Z0-9_-]+$` on tool names: dots travel
 * as underscores on the wire and map back to catalog action types here. */
const wireName = (actionType: string): string => actionType.replace(/\./g, '_');

const TOOL_CATALOG = TOOL_DEFINITIONS.map((definition) => ({
  type: 'function' as const,
  function: {
    name: wireName(definition.actionType),
    description: definition.description,
    parameters: definition.parameters,
  },
}));

/** Liberal on input: accept the wire form AND the dotted catalog form. */
const ACTION_TYPE_BY_TOOL_NAME = new Map(
  TOOL_DEFINITIONS.flatMap((definition) => [
    [wireName(definition.actionType), definition.actionType] as const,
    [definition.actionType, definition.actionType] as const,
  ]),
);

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
    // Misdetected language on short utterances is a REAL failure mode
    // (a Spanish caller was answered in Portuguese): pin the channel's
    // expected language and forbid mid-conversation switches.
    const languageRule = context.lang
      ? `The expected caller language is ${context.lang}. Reply in the language the caller actually speaks; when in doubt, use ${context.lang}. NEVER switch languages mid-conversation unless the caller clearly does. `
      : 'Reply in the language the caller speaks and keep it consistent for the whole conversation. ';

    const messages = [
      {
        role: 'system',
        content:
          'You are AURION, a voice support agent for one company. This is a LIVE PHONE-STYLE conversation: keep replies to one or two short sentences, natural and direct. ' +
          languageRule +
          'You may use the provided tools to REGISTER requests; be honest that registered requests run only after a human approves them — never claim something was already done. ' +
          (context.knowledge.length > 0
            ? `The company knowledge base covers: ${context.knowledge.join(', ')}.`
            : 'No knowledge base is published yet.'),
      },
      ...context.transcript.map((turn) => ({
        role: turn.speaker === 'caller' ? 'user' : 'assistant',
        content: turn.text,
      })),
      // Recency beats verbosity: a trailing reminder holds the language
      // lock better than the opening prompt alone (live drift evidence).
      ...(context.lang
        ? [
            {
              role: 'system',
              content: `CRITICAL: detect the language of the caller's LAST message and reply ONLY in that language. If ambiguous or mixed, reply in ${context.lang}.`,
            },
          ]
        : []),
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
          // GPT-5-era models REJECT max_tokens (400) and require this name;
          // OpenAI-compatible servers accept it too. Found live on the phone.
          max_completion_tokens: this.config.maxTokens,
          // Latency lever for reasoning models (measured live on gpt-5.5:
          // low ≈ 1.7 s vs ≈ 3.0 s default; 'minimal' is rejected there).
          ...(this.config.reasoningEffort
            ? { reasoning_effort: this.config.reasoningEffort }
            : {}),
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

    // Fallbacks SPEAK to the caller and feed the transcript: they must
    // follow the channel language or they drag the whole conversation
    // into English (a live Spanish call drifted exactly this way).
    const spanish = context.lang?.toLowerCase().startsWith('es') ?? false;
    const toolIntent = this.extractIntent(message.tool_calls);
    const text =
      typeof message.content === 'string' && message.content.trim().length > 0
        ? message.content.trim()
        : toolIntent
          ? spanish
            ? 'He registrado tu solicitud; se ejecutará en cuanto una persona la apruebe.'
            : 'I have registered your request; it will run once a human approves it.'
          : spanish
            ? '¿Puedes contarme un poco más sobre lo que necesitas?'
            : 'Could you tell me a bit more about what you need?';

    return { text, toolIntent };
  }

  /** First KNOWN tool call wins; unknown tools and bad arguments are dropped. */
  private extractIntent(
    toolCalls: Array<{ function?: { name?: string; arguments?: string } }> | undefined,
  ): ToolIntent | null {
    for (const call of toolCalls ?? []) {
      const name = call.function?.name;
      const actionType = name ? ACTION_TYPE_BY_TOOL_NAME.get(name) : undefined;
      if (!actionType) {
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
      return { actionType, payload: { ...payload, channel: 'voice' } };
    }
    return null;
  }
}
