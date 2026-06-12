import { describe, expect, it, vi } from 'vitest';

import { PostCallSummarizer } from '../src/application/post-call-summarizer.js';

const CONFIG = {
  apiUrl: 'https://llm.example.test/v1',
  apiKey: 'test-api-key',
  model: 'test-model',
  timeoutMs: 5000,
  maxTokens: 500,
};

const TURNS = [
  { index: 0, speaker: 'caller' as const, text: 'Hello, I need help with pricing.' },
  { index: 1, speaker: 'agent' as const, text: 'Of course! Let me explain our plans.' },
];

function okResponse(content: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  } as unknown as Response;
}

function httpErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response;
}

const VALID_JSON = JSON.stringify({
  summary: 'Caller asked about pricing.',
  intent: 'pricing inquiry',
  caller_name: null,
  callback_number: null,
  lead_quality: 'warm',
  action_items: ['Send pricing PDF'],
  language: 'en-US',
});

describe('PostCallSummarizer retry policy', () => {
  it('does NOT retry a 400 response — fetch is called exactly once', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(httpErrorResponse(400));
    const logs: string[] = [];
    const summarizer = new PostCallSummarizer(CONFIG, fetchImpl, (msg) => logs.push(msg));

    const result = await summarizer.summarize(TURNS);

    expect(result).toBeNull();
    // Exactly one fetch call — 400 is non-retryable.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // The log must mention it was non-retryable, not a retry.
    expect(logs.some((l) => l.includes('non-retryable'))).toBe(true);
  });

  it('does NOT retry a 422 response — fetch is called exactly once', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(httpErrorResponse(422));
    const summarizer = new PostCallSummarizer(CONFIG, fetchImpl);

    const result = await summarizer.summarize(TURNS);

    expect(result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('DOES retry a 503 response — fetch is called exactly twice', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(httpErrorResponse(503))
      .mockResolvedValueOnce(okResponse(VALID_JSON));
    const logs: string[] = [];
    const summarizer = new PostCallSummarizer(CONFIG, fetchImpl, (msg) => logs.push(msg));

    const result = await summarizer.summarize(TURNS);

    // Second attempt succeeds.
    expect(result).not.toBeNull();
    expect(result?.summary).toBe('Caller asked about pricing.');
    // Two fetch calls — one failure + one successful retry.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(logs.some((l) => l.includes('retrying'))).toBe(true);
  });

  it('DOES retry a 429 (rate limited) response — fetch is called twice on double failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(httpErrorResponse(429))
      .mockResolvedValueOnce(httpErrorResponse(429));
    const summarizer = new PostCallSummarizer(CONFIG, fetchImpl);

    const result = await summarizer.summarize(TURNS);

    expect(result).toBeNull();
    // Both attempts made — 429 is retryable (transient rate limit).
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('skips summarization entirely for silent calls (zero caller turns)', async () => {
    const fetchImpl = vi.fn();
    const summarizer = new PostCallSummarizer(CONFIG, fetchImpl);

    const result = await summarizer.summarize([
      { index: 0, speaker: 'agent' as const, text: 'Hello?' },
    ]);

    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
