import { Conversation } from '../domain/conversation.js';
import type { AgentBrainPort, AurionApiPort } from './ports.js';
import type { PostCallSummarizer } from './post-call-summarizer.js';

/**
 * Orchestrates one conversation against the system of record (ADR-018).
 *
 * Invariants:
 *  - The gateway is a `voice_agent`: tool intents become REQUESTED actions,
 *    reported as approval-pending. Execution authority stays with humans on
 *    the dashboard — this engine has no execute path at all.
 *  - Action requests are turn-keyed (`vg:<session>:<turn>`): replaying a
 *    turn after a reconnect can never duplicate a side effect.
 *  - Every conversation ends as `completed` (with a bounded summary) or
 *    `failed` — silence is never an outcome.
 */
export class EngineError extends Error {
  constructor(
    readonly code: 'no_session' | 'session_already_started' | 'upstream_failed',
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

export interface TurnResult {
  readonly reply: string;
  readonly requestedAction: {
    readonly actionId: string;
    readonly actionType: string;
  } | null;
}

export class ConversationEngine {
  private readonly conversation = new Conversation();
  private sessionId: string | null = null;
  private closed = false;

  constructor(
    private readonly api: AurionApiPort,
    private readonly brain: AgentBrainPort,
    /** Channel's expected caller language (e.g. the phone line's es-ES). */
    private readonly lang?: string,
    /** Optional post-call summarizer; when provided, fires after session close (Phase-30). */
    private readonly summarizer?: PostCallSummarizer | null,
    /** Optional caller number captured from the call's start frame (Phase-30). */
    private readonly callerNumber?: string | null,
  ) {}

  get isStarted(): boolean {
    return this.sessionId !== null;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  async start(externalSessionId: string): Promise<string> {
    if (this.sessionId) {
      throw new EngineError('session_already_started', 'This connection already has a session.');
    }
    const { sessionId } = await this.api.startSession(externalSessionId, this.callerNumber);
    this.sessionId = sessionId;
    return sessionId;
  }

  async userTurn(text: string): Promise<TurnResult> {
    const sessionId = this.requireSession();
    const turn = this.conversation.addCallerTurn(text);

    const knowledge = await this.api.listPublishedKnowledge();
    const reply = await this.brain.respond({
      transcript: this.conversation.transcript,
      knowledge,
      lang: this.lang,
    });
    this.conversation.addAgentTurn(reply.text);

    if (!reply.toolIntent) {
      return { reply: reply.text, requestedAction: null };
    }

    // Turn-keyed idempotency: the same turn replayed lands on the same key,
    // and ADR-013 replay semantics return the original action.
    const requested = await this.api.requestAction({
      sessionId,
      actionType: reply.toolIntent.actionType,
      payload: reply.toolIntent.payload,
      idempotencyKey: `vg:${sessionId}:${turn}`,
    });
    this.conversation.recordAction({
      actionId: requested.actionId,
      actionType: reply.toolIntent.actionType,
      turn,
    });

    return {
      reply: reply.text,
      requestedAction: {
        actionId: requested.actionId,
        actionType: reply.toolIntent.actionType,
      },
    };
  }

  async pollAction(actionId: string): Promise<string> {
    this.requireSession();
    return this.api.getActionStatus(actionId);
  }

  /** Graceful close: persists the transcript-derived summary. */
  async end(outcome?: string): Promise<{ sessionId: string; status: 'completed' }> {
    const sessionId = this.requireSession();
    if (!this.closed) {
      this.closed = true;
      await this.api.closeSession(sessionId, 'completed', {
        summary: this.conversation.buildSummary(),
        outcome,
      });
      // Fire-and-forget: the summarizer runs AFTER closeSession resolves and
      // MUST NOT delay socket teardown or the `session.ended` event (Phase-30).
      this.firePostCallSummary(sessionId);
    }
    return { sessionId, status: 'completed' };
  }

  /** Abort path (socket drop, upstream failure): the record says `failed`. */
  async abort(reason: string): Promise<void> {
    if (!this.sessionId || this.closed) {
      return;
    }
    this.closed = true;
    try {
      await this.api.closeSession(this.sessionId, 'failed', {
        summary: this.conversation.buildSummary(),
        outcome: reason,
      });
      // Fire-and-forget even on aborted sessions — we still want the summary.
      this.firePostCallSummary(this.sessionId);
    } catch {
      // The API is the system of record; if it is unreachable the session
      // stays `active` and operational tooling reaps it — nothing to do here.
    }
  }

  /**
   * Enqueue the post-call summarizer as a fire-and-forget promise.
   * The promise is intentionally NOT awaited: callers depend on `end()`
   * and `abort()` returning quickly for socket teardown.
   */
  private firePostCallSummary(sessionId: string): void {
    if (!this.summarizer) {
      return;
    }
    const turns = [...this.conversation.transcript];
    void this.summarizer
      .summarize(turns)
      .then(async (result) => {
        if (!result) {
          return;
        }
        await this.api.patchAiSummary(sessionId, {
          ai_summary: result.summary,
          ai_insights: result.insights,
        });
      })
      .catch((error: unknown) => {
        // Non-fatal: the session record already exists without AI fields.
        process.stdout.write(
          `post-call summary failed for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      });
  }

  private requireSession(): string {
    if (!this.sessionId) {
      throw new EngineError('no_session', 'Start the session first (session.start).');
    }
    if (this.closed) {
      throw new EngineError('no_session', 'This session is already closed.');
    }
    return this.sessionId;
  }
}
