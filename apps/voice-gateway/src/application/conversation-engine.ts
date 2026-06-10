import { Conversation } from '../domain/conversation.js';
import type { AgentBrainPort, AurionApiPort } from './ports.js';

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
    const { sessionId } = await this.api.startSession(externalSessionId);
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
    } catch {
      // The API is the system of record; if it is unreachable the session
      // stays `active` and operational tooling reaps it — nothing to do here.
    }
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
