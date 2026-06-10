import { describe, expect, it } from 'vitest';

import { loadGatewayConfig } from '../src/config.js';
import { parseClientEvent, ProtocolError } from '../src/infrastructure/protocol.js';
import { ScriptedBrain } from '../src/infrastructure/scripted-brain.js';

const VALID_ENV = {
  AURION_API_URL: 'http://localhost:3000',
  VOICE_AGENT_TOKEN: 'aaa.bbb.ccc',
  VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
};

describe('loadGatewayConfig (fail closed)', () => {
  it('loads a complete configuration with defaults', () => {
    const config = loadGatewayConfig(VALID_ENV);
    expect(config.port).toBe(8080);
    expect(config.brainMode).toBe('scripted');
    expect(config.clientKeys).toHaveLength(1);
  });

  it('requires the API URL, a JWT-shaped token, and 16+ char client keys', () => {
    expect(() => loadGatewayConfig({ ...VALID_ENV, AURION_API_URL: undefined })).toThrow(
      /AURION_API_URL/,
    );
    expect(() => loadGatewayConfig({ ...VALID_ENV, VOICE_AGENT_TOKEN: 'not-a-jwt' })).toThrow(
      /VOICE_AGENT_TOKEN/,
    );
    expect(() =>
      loadGatewayConfig({ ...VALID_ENV, VOICE_GATEWAY_CLIENT_KEYS: 'short' }),
    ).toThrow(/CLIENT_KEYS/);
    expect(() => loadGatewayConfig({ ...VALID_ENV, BRAIN_MODE: 'gpt' })).toThrow(/BRAIN_MODE/);
  });
});

describe('protocol parsing (fail closed, socket stays open)', () => {
  it('parses every documented client event', () => {
    expect(parseClientEvent(JSON.stringify({ type: 'session.start' }))).toEqual({
      type: 'session.start',
      external_session_id: undefined,
    });
    expect(parseClientEvent(JSON.stringify({ type: 'turn.user', text: 'hola' }))).toEqual({
      type: 'turn.user',
      text: 'hola',
    });
    expect(parseClientEvent(JSON.stringify({ type: 'action.poll', action_id: 'a-1' }))).toEqual({
      type: 'action.poll',
      action_id: 'a-1',
    });
    expect(parseClientEvent(JSON.stringify({ type: 'session.end', outcome: 'ok' }))).toEqual({
      type: 'session.end',
      outcome: 'ok',
    });
  });

  it('rejects non-JSON, non-objects, unknown types, and empty turns', () => {
    expect(() => parseClientEvent('not json')).toThrow(ProtocolError);
    expect(() => parseClientEvent(JSON.stringify([1, 2]))).toThrow(ProtocolError);
    expect(() => parseClientEvent(JSON.stringify({ type: 'hack.me' }))).toThrow(/Unknown event/);
    expect(() => parseClientEvent(JSON.stringify({ type: 'turn.user', text: '  ' }))).toThrow(
      /non-empty/,
    );
    expect(() => parseClientEvent(JSON.stringify({ type: 'action.poll' }))).toThrow(/action_id/);
  });
});

describe('ScriptedBrain (deterministic intents)', () => {
  const brain = new ScriptedBrain();

  it('maps issue language to a ticket.create intent', async () => {
    const reply = await brain.respond({
      transcript: [{ index: 0, speaker: 'caller', text: 'tengo un problema con mi pedido' }],
      knowledge: [],
    });
    expect(reply.toolIntent?.actionType).toBe('ticket.create');
  });

  it('maps appointment language to a calendar.update intent', async () => {
    const reply = await brain.respond({
      transcript: [{ index: 0, speaker: 'caller', text: 'quiero cambiar mi cita' }],
      knowledge: [],
    });
    expect(reply.toolIntent?.actionType).toBe('calendar.update');
  });

  it('answers from published knowledge when there is no tool intent', async () => {
    const reply = await brain.respond({
      transcript: [{ index: 0, speaker: 'caller', text: 'hola' }],
      knowledge: ['Pricing FAQ', 'Refund policy'],
    });
    expect(reply.toolIntent).toBeNull();
    expect(reply.text).toContain('Pricing FAQ');
  });
});
