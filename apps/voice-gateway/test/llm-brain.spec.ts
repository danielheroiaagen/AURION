import { describe, expect, it, vi } from 'vitest';

import { loadGatewayConfig } from '../src/config.js';
import { BrainError, LlmBrain } from '../src/infrastructure/llm-brain.js';

const CONFIG = {
  apiUrl: 'https://llm.example.test/v1',
  apiKey: 'test-api-key',
  model: 'test-model',
  timeoutMs: 1000,
  maxTokens: 300,
};

const CONTEXT = {
  transcript: [
    { index: 0, speaker: 'caller' as const, text: 'hola, tengo un problema con mi pedido' },
  ],
  knowledge: ['Pricing FAQ', 'Refund policy'],
};

function completion(message: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message }] }),
  } as unknown as Response;
}

describe('gateway config: llm mode (fail closed)', () => {
  const BASE = {
    AURION_API_URL: 'http://localhost:3000',
    VOICE_AGENT_TOKEN: 'a.b.c',
    VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
    BRAIN_MODE: 'llm',
  };

  it('requires endpoint, key, and model', () => {
    expect(() => loadGatewayConfig(BASE)).toThrow(/LLM_API_URL/);
    expect(() => loadGatewayConfig({ ...BASE, LLM_API_URL: 'https://llm.test/v1' })).toThrow(
      /LLM_API_KEY/,
    );
    expect(() =>
      loadGatewayConfig({ ...BASE, LLM_API_URL: 'https://llm.test/v1', LLM_API_KEY: 'k'.repeat(12) }),
    ).toThrow(/LLM_MODEL/);

    const config = loadGatewayConfig({
      ...BASE,
      LLM_API_URL: 'https://llm.test/v1/',
      LLM_API_KEY: 'k'.repeat(12),
      LLM_MODEL: 'gpt-x',
    });
    expect(config.brainMode).toBe('llm');
    expect(config.llm).toMatchObject({ apiUrl: 'https://llm.test/v1', model: 'gpt-x' });
  });

  it('scripted mode stays the default and needs no llm settings', () => {
    expect(loadGatewayConfig({ ...BASE, BRAIN_MODE: undefined }).brainMode).toBe('scripted');
  });
});

describe('LlmBrain', () => {
  it('sends the catalog tools, knowledge titles, and auth header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(completion({ content: 'Hola, ¿en qué ayudo?' }));
    const reply = await new LlmBrain(CONFIG, fetchImpl).respond(CONTEXT);
    expect(reply).toEqual({ text: 'Hola, ¿en qué ayudo?', toolIntent: null });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://llm.example.test/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-api-key');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('test-model');
    expect(body.tools.map((tool: { function: { name: string } }) => tool.function.name)).toEqual([
      'ticket.create',
      'calendar.update',
    ]);
    expect(body.messages[0].content).toContain('Pricing FAQ');
    expect(body.messages[0].content).toContain('human approves');
    expect(body.messages[1]).toEqual({ role: 'user', content: CONTEXT.transcript[0].text });
  });

  it('maps a catalog tool call to a ToolIntent (the approval path is untouched)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      completion({
        content: 'He registrado tu incidencia.',
        tool_calls: [
          { function: { name: 'ticket.create', arguments: '{"subject":"pedido roto"}' } },
        ],
      }),
    );
    const reply = await new LlmBrain(CONFIG, fetchImpl).respond(CONTEXT);
    expect(reply.toolIntent).toEqual({
      actionType: 'ticket.create',
      payload: { subject: 'pedido roto', channel: 'voice' },
    });
  });

  it('drops unknown tools — the model cannot mint capabilities', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      completion({
        content: 'ok',
        tool_calls: [
          { function: { name: 'database.drop', arguments: '{}' } },
          { function: { name: 'calendar.update', arguments: '{"request":"mover cita"}' } },
        ],
      }),
    );
    const reply = await new LlmBrain(CONFIG, fetchImpl).respond(CONTEXT);
    expect(reply.toolIntent?.actionType).toBe('calendar.update');
  });

  it('tolerates malformed tool arguments without dropping the request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      completion({
        content: null,
        tool_calls: [{ function: { name: 'ticket.create', arguments: 'not json' } }],
      }),
    );
    const reply = await new LlmBrain(CONFIG, fetchImpl).respond(CONTEXT);
    expect(reply.toolIntent).toEqual({ actionType: 'ticket.create', payload: { channel: 'voice' } });
    // No content from the model → honest default mentioning approval.
    expect(reply.text).toContain('human approves');
  });

  it('raises BrainError on timeout, non-2xx, and empty responses (never fabricates)', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    await expect(
      new LlmBrain(CONFIG, vi.fn().mockRejectedValue(abortError)).respond(CONTEXT),
    ).rejects.toBeInstanceOf(BrainError);

    await expect(
      new LlmBrain(
        CONFIG,
        vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as unknown as Response),
      ).respond(CONTEXT),
    ).rejects.toThrow(/503/);

    await expect(
      new LlmBrain(
        CONFIG,
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as unknown as Response),
      ).respond(CONTEXT),
    ).rejects.toThrow(/no message/);
  });
});
