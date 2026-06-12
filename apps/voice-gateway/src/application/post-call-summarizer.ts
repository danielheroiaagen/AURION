import type { LlmConfig } from '../config.js';
import type { ConversationTurn } from '../domain/conversation.js';
import type { PostCallInsights } from './ports.js';

/**
 * Post-call intelligence: generate a structured summary of the completed
 * conversation using the same LLM endpoint as the brain (Phase-30, ADR-039).
 *
 * Design rules:
 *  - Fire-and-forget: callers MUST NOT await this for socket teardown.
 *  - Silent calls (zero user turns) are skipped — no tokens burned.
 *  - One retry on network/5xx failure; then gives up with a log line.
 *  - Uses `max_completion_tokens` (not `max_tokens`) — gpt-5.x API contract.
 *  - No tools, no response_format — plain text JSON in the content field
 *    to stay compatible with every OpenAI-compatible endpoint.
 *  - Robust parsing: strip markdown code fences, tolerate surrounding text.
 */

export interface PostCallSummary {
  readonly summary: string;
  readonly insights: PostCallInsights;
}

const SYSTEM_PROMPT = `You are a post-call intelligence assistant for a business owner.
Analyze the voice conversation transcript and produce ONLY a JSON object with exactly these keys:
{
  "summary": "<string, max 600 chars, written in the language of the call>",
  "intent": "<string, main reason the caller called>",
  "caller_name": "<string or null>",
  "callback_number": "<string or null>",
  "lead_quality": "<'hot' | 'warm' | 'cold' | null>",
  "action_items": ["<string>"],
  "language": "<BCP-47 language code, e.g. es-ES or en-US>"
}
Output ONLY the JSON object — no markdown fences, no explanation, no other text.`;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

/**
 * Thrown by `callLlm` when the HTTP response status is non-retryable (i.e. not
 * a network error, not 5xx, and not 429). Callers inspect this to decide
 * whether a retry would be pointless.
 */
export class NonRetryableHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'NonRetryableHttpError';
  }
}

/** Returns true for error types that are worth retrying (transient failures). */
function isRetryable(error: unknown): boolean {
  if (error instanceof NonRetryableHttpError) {
    return false;
  }
  // Network errors, AbortErrors, and any other unknown errors are transient.
  return true;
}

export class PostCallSummarizer {
  constructor(
    private readonly config: LlmConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly log: (message: string) => void = (msg) =>
      process.stdout.write(`${msg}\n`),
  ) {}

  /**
   * Summarize the conversation. Returns null when:
   *  - There are zero user turns (silent/test call — no tokens burned).
   *  - The LLM returns unparseable output after retries.
   */
  async summarize(
    turns: readonly ConversationTurn[],
  ): Promise<PostCallSummary | null> {
    const userTurns = turns.filter((t) => t.speaker === 'caller');
    if (userTurns.length === 0) {
      // Silent call — skip post-call summarization entirely.
      return null;
    }

    const transcript = turns
      .map((t) => `${t.speaker === 'caller' ? 'Caller' : 'Agent'}: ${t.text}`)
      .join('\n');

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Conversation transcript:\n${transcript}` },
    ];

    const result = await this.callWithRetry(messages);
    return result;
  }

  private async callWithRetry(
    messages: Array<{ role: string; content: string }>,
  ): Promise<PostCallSummary | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parsed = await this.callLlm(messages);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!isRetryable(error)) {
          // Non-retryable (e.g. 400/401/403/404/422): fail immediately — a
          // second call would produce the same result and waste tokens.
          this.log(`post-call summarizer non-retryable error: ${message}`);
          return null;
        }
        if (attempt === 0) {
          this.log(`post-call summarizer attempt 1 failed: ${message}; retrying`);
        } else {
          this.log(`post-call summarizer failed after retry: ${message}`);
        }
      }
    }
    return null;
  }

  private async callLlm(
    messages: Array<{ role: string; content: string }>,
  ): Promise<PostCallSummary | null> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs,
    );

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          // GPT-5-era models REJECT max_tokens — use max_completion_tokens (ADR-022 / gpt5-api-gotchas).
          max_completion_tokens: this.config.maxTokens,
          messages,
          // No tools, no response_format — plain text output is more compatible.
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const msg = `LLM endpoint responded ${response.status} for post-call summary.`;
      // 5xx and 429 are transient; all other non-2xx statuses are non-retryable.
      if (response.status >= 500 || response.status === 429) {
        throw new Error(msg);
      }
      throw new NonRetryableHttpError(response.status, msg);
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      this.log('post-call summarizer: empty content from LLM');
      return null;
    }

    return this.parseOutput(content);
  }

  /**
   * Strip markdown code fences and parse the JSON. Tolerates surrounding text
   * by looking for the first `{` and the last `}`.
   */
  private parseOutput(content: string): PostCallSummary | null {
    // Remove ```json ... ``` fences.
    let text = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    // Find the outermost JSON object even if there is surrounding prose.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      this.log(`post-call summarizer: no JSON object found in LLM output`);
      return null;
    }
    text = text.slice(start, end + 1);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      this.log(`post-call summarizer: JSON.parse failed on LLM output`);
      return null;
    }

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim().slice(0, 600)
        : null;

    if (!summary) {
      this.log(`post-call summarizer: missing summary field in LLM output`);
      return null;
    }

    const insights: PostCallInsights = {
      intent: typeof parsed.intent === 'string' ? parsed.intent : undefined,
      caller_name:
        typeof parsed.caller_name === 'string' || parsed.caller_name === null
          ? (parsed.caller_name as string | null)
          : null,
      callback_number:
        typeof parsed.callback_number === 'string' || parsed.callback_number === null
          ? (parsed.callback_number as string | null)
          : null,
      lead_quality: isLeadQuality(parsed.lead_quality) ? parsed.lead_quality : null,
      action_items: Array.isArray(parsed.action_items)
        ? (parsed.action_items as unknown[])
            .filter((item): item is string => typeof item === 'string')
        : [],
      language: typeof parsed.language === 'string' ? parsed.language : undefined,
    };

    return { summary, insights };
  }
}

function isLeadQuality(
  value: unknown,
): value is 'hot' | 'warm' | 'cold' | null {
  return value === null || value === 'hot' || value === 'warm' || value === 'cold';
}
