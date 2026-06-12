import { describe, expect, it, vi } from 'vitest';

import { ConversationEngine, EngineError } from '../src/application/conversation-engine.js';
import type {
  AgentBrainPort,
  AurionApiPort,
  BrainReply,
  RequestedAction,
} from '../src/application/ports.js';
import type { PostCallSummarizer } from '../src/application/post-call-summarizer.js';

class FakeApi implements AurionApiPort {
  started: string[] = [];
  actionRequests: Array<{ idempotencyKey: string; actionType: string; sessionId: string }> = [];
  closes: Array<{ sessionId: string; status: string; summary?: string; outcome?: string }> = [];
  closeError: Error | null = null;
  actionStatus = 'requested';

  async startSession(externalSessionId: string) {
    this.started.push(externalSessionId);
    return { sessionId: 'session-1' };
  }

  async listPublishedKnowledge() {
    return ['Pricing FAQ'];
  }

  async requestAction(input: {
    sessionId: string;
    actionType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<RequestedAction> {
    this.actionRequests.push(input);
    return { actionId: `action-${this.actionRequests.length}`, status: 'requested', approvalRequired: true };
  }

  async getActionStatus(): Promise<string> {
    return this.actionStatus;
  }

  async closeSession(
    sessionId: string,
    status: 'completed' | 'failed',
    fields: { summary?: string; outcome?: string },
  ): Promise<void> {
    if (this.closeError) {
      throw this.closeError;
    }
    this.closes.push({ sessionId, status, ...fields });
  }

  async patchAiSummary(): Promise<void> {
    // No-op in tests: post-call summarizer is not exercised by the engine tests.
  }
}

function brainReplying(...replies: BrainReply[]): AgentBrainPort {
  let index = 0;
  return {
    respond: async () => replies[Math.min(index++, replies.length - 1)],
  };
}

const PLAIN: BrainReply = { text: 'How can I help?', toolIntent: null };
const TICKET: BrainReply = {
  text: 'Ticket requested.',
  toolIntent: { actionType: 'ticket.create', payload: { subject: 'help' } },
};

describe('ConversationEngine', () => {
  it('runs the full conversation flow and persists the summary on close', async () => {
    const api = new FakeApi();
    const engine = new ConversationEngine(api, brainReplying(PLAIN, TICKET));

    await engine.start('ext-1');
    expect(api.started).toEqual(['ext-1']);

    const first = await engine.userTurn('hola');
    expect(first.reply).toBe('How can I help?');
    expect(first.requestedAction).toBeNull();

    const second = await engine.userTurn('I have a problem, open a ticket');
    expect(second.requestedAction).toEqual({ actionId: 'action-1', actionType: 'ticket.create' });

    const closed = await engine.end('resolved');
    expect(closed.status).toBe('completed');
    expect(api.closes).toHaveLength(1);
    expect(api.closes[0].status).toBe('completed');
    expect(api.closes[0].outcome).toBe('resolved');
    // Transcript-derived summary records both sides and the requested action.
    expect(api.closes[0].summary).toContain('caller: hola');
    expect(api.closes[0].summary).toContain('agent: Ticket requested.');
    expect(api.closes[0].summary).toContain('ticket.create (action-1)');
  });

  it('keys action requests by session and turn (reconnect-safe idempotency)', async () => {
    const api = new FakeApi();
    const engine = new ConversationEngine(api, brainReplying(TICKET, TICKET));

    await engine.start('ext-2');
    await engine.userTurn('ticket one');
    await engine.userTurn('ticket two');

    expect(api.actionRequests.map((request) => request.idempotencyKey)).toEqual([
      'vg:session-1:1',
      'vg:session-1:2',
    ]);
  });

  it('never executes: tool intents end as approval-pending requests only', async () => {
    const api = new FakeApi();
    const engine = new ConversationEngine(api, brainReplying(TICKET));

    await engine.start('ext-3');
    const result = await engine.userTurn('ticket please');
    expect(result.requestedAction).not.toBeNull();
    // The fake API records ONLY a request; the port has no execute method at
    // all — execution authority lives with humans (ADR-018).
    expect(api.actionRequests).toHaveLength(1);
    expect(await engine.pollAction('action-1')).toBe('requested');
  });

  it('rejects turns before session.start and double starts', async () => {
    const api = new FakeApi();
    const engine = new ConversationEngine(api, brainReplying(PLAIN));

    await expect(engine.userTurn('hello')).rejects.toBeInstanceOf(EngineError);
    await engine.start('ext-4');
    await expect(engine.start('ext-4')).rejects.toMatchObject({
      code: 'session_already_started',
    });
  });

  it('aborts as failed and stays silent-failure-free on API loss', async () => {
    const api = new FakeApi();
    const engine = new ConversationEngine(api, brainReplying(PLAIN));

    await engine.start('ext-5');
    await engine.userTurn('hola');
    await engine.abort('connection_dropped');

    expect(api.closes[0].status).toBe('failed');
    expect(api.closes[0].outcome).toBe('connection_dropped');

    // Abort after close is a no-op; abort with the API down does not throw.
    await engine.abort('again');
    expect(api.closes).toHaveLength(1);

    const failingApi = new FakeApi();
    failingApi.closeError = new Error('api down');
    const fragile = new ConversationEngine(failingApi, brainReplying(PLAIN));
    await fragile.start('ext-6');
    await expect(fragile.abort('drop')).resolves.toBeUndefined();
  });

  it('refuses turns after the session is closed', async () => {
    const api = new FakeApi();
    const engine = new ConversationEngine(api, brainReplying(PLAIN));
    await engine.start('ext-7');
    await engine.end();
    await expect(engine.userTurn('more')).rejects.toMatchObject({ code: 'no_session' });
  });

  it('end() resolves without waiting for the summarizer (fire-and-forget contract)', async () => {
    const api = new FakeApi();
    const patchAiSummary = vi.spyOn(api, 'patchAiSummary');

    // A summarizer whose promise is controlled externally — we never resolve it
    // during this test, so any accidental await of it would hang end().
    let resolveSummary!: () => void;
    const summaryPromise = new Promise<void>((resolve) => {
      resolveSummary = resolve;
    });

    const fakeSummarizer: PostCallSummarizer = {
      summarize: vi.fn().mockReturnValue(
        summaryPromise.then(() => ({
          summary: 'test summary',
          insights: {},
        })),
      ),
    } as unknown as PostCallSummarizer;

    const engine = new ConversationEngine(
      api,
      brainReplying(PLAIN),
      undefined,
      fakeSummarizer,
    );

    await engine.start('ext-8');
    await engine.userTurn('hello');

    // end() must resolve quickly — the summarizer promise is still pending.
    const endResult = await engine.end('done');
    expect(endResult.status).toBe('completed');

    // At the moment end() resolved, patchAiSummary must NOT have been called
    // yet (the summarizer promise is still pending).
    expect(patchAiSummary).not.toHaveBeenCalled();

    // Resolve the summarizer to avoid any unhandled-rejection noise.
    resolveSummary();
    // Yield the microtask queue so the fire-and-forget chain can settle.
    await Promise.resolve();
    await Promise.resolve();
  });
});
