import type { AgentBrainPort, BrainContext, BrainReply } from '../application/ports.js';

/**
 * Deterministic brain for development, CI and demos (ADR-018). Honest about
 * itself the same way the noop dispatcher is: every reply is derived from
 * simple intent patterns, no model is involved. Realtime speech/LLM
 * providers are future adapters behind the same port.
 */
export class ScriptedBrain implements AgentBrainPort {
  async respond(context: BrainContext): Promise<BrainReply> {
    const lastCaller = [...context.transcript].reverse().find((turn) => turn.speaker === 'caller');
    const text = (lastCaller?.text ?? '').toLowerCase();

    if (text.includes('ticket') || text.includes('problema') || text.includes('issue')) {
      return {
        text: 'I have registered a support ticket request. A human will approve it shortly.',
        toolIntent: {
          actionType: 'ticket.create',
          payload: { subject: lastCaller?.text ?? 'Caller issue', channel: 'voice' },
        },
      };
    }

    if (text.includes('cita') || text.includes('appointment') || text.includes('reschedul')) {
      return {
        text: 'I have requested the calendar change. It will run once a human approves it.',
        toolIntent: {
          actionType: 'calendar.update',
          payload: { request: lastCaller?.text ?? 'Calendar change', channel: 'voice' },
        },
      };
    }

    if (text.includes('email') || text.includes('correo')) {
      return {
        text: 'I have registered the email request. It will be sent once a human approves it.',
        toolIntent: {
          actionType: 'email.send',
          payload: { subject: 'Caller email request', body: lastCaller?.text ?? '', channel: 'voice' },
        },
      };
    }

    if (text.includes('whatsapp') || text.includes('mensaje')) {
      return {
        text: 'I have registered the WhatsApp message. It will be sent once a human approves it.',
        toolIntent: {
          actionType: 'whatsapp.send',
          payload: { message: lastCaller?.text ?? '', channel: 'voice' },
        },
      };
    }

    if (context.knowledge.length > 0) {
      return {
        text: `I can help with: ${context.knowledge.join(', ')}. What do you need?`,
        toolIntent: null,
      };
    }

    return {
      text: 'I am the AURION assistant. Tell me about your issue or appointment.',
      toolIntent: null,
    };
  }
}
