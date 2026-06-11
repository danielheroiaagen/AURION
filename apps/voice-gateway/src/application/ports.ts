import type { ConversationTurn } from '../domain/conversation.js';

/**
 * Driven ports of the voice gateway (ADR-018). The engine depends on these
 * only; adapters are selected at startup.
 */

// --- Agent brain -----------------------------------------------------------

export interface BrainContext {
  readonly transcript: readonly ConversationTurn[];
  /** Titles of the tenant's published knowledge documents. */
  readonly knowledge: readonly string[];
}

export interface ToolIntent {
  readonly actionType: string;
  readonly payload: Record<string, unknown>;
}

export interface BrainReply {
  readonly text: string;
  readonly toolIntent: ToolIntent | null;
}

export interface AgentBrainPort {
  respond(context: BrainContext): Promise<BrainReply>;
}

// --- Speech to text ----------------------------------------------------------

export interface UtteranceAudio {
  readonly audio: Buffer;
  readonly mimeType: string;
  readonly lang?: string;
}

export interface TranscriptionPort {
  /** Recognized text for one utterance; empty string when nothing was heard.
   * The audio is transient (ADR-025): forwarded to the provider and dropped. */
  transcribe(input: UtteranceAudio): Promise<string>;
}

// --- Text to speech ----------------------------------------------------------

export interface SynthesizedSpeech {
  readonly audio: Buffer;
  readonly mimeType: string;
}

export interface SpeechSynthesisPort {
  /** Spoken audio for one agent reply. Audio is an enhancement (ADR-026):
   * the TEXT event is the source of truth and is delivered first. */
  synthesize(text: string): Promise<SynthesizedSpeech>;
}

// --- AURION API (system of record) ------------------------------------------

export interface StartedSession {
  readonly sessionId: string;
}

export interface RequestedAction {
  readonly actionId: string;
  readonly status: string;
  readonly approvalRequired: boolean;
}

export interface AurionApiPort {
  /** POST /voice-sessions (idempotent on external_session_id) + transition to active. */
  startSession(externalSessionId: string): Promise<StartedSession>;
  /** Published knowledge titles for the brain context. */
  listPublishedKnowledge(): Promise<readonly string[]>;
  /** POST /actions with the turn-keyed Idempotency-Key. */
  requestAction(input: {
    sessionId: string;
    actionType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<RequestedAction>;
  /** GET /actions/:id → current status. */
  getActionStatus(actionId: string): Promise<string>;
  /** Transition to completed/failed with closing fields. */
  closeSession(
    sessionId: string,
    status: 'completed' | 'failed',
    fields: { summary?: string; outcome?: string },
  ): Promise<void>;
}
