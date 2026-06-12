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
  /** Channel's expected caller language (BCP 47), when known. */
  readonly lang?: string;
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

// --- Streaming speech to text (telephony, ADR-027) ---------------------------

export interface UtteranceStreamHandlers {
  /** One complete caller utterance, as segmented by the provider's VAD. */
  onUtterance(text: string): void;
  /** The caller started speaking — barge-in hook. */
  onSpeechStarted?(): void;
  onError(error: Error): void;
}

export interface UtteranceStream {
  /** Feed one audio chunk in the call's wire format (μ-law 8 kHz). */
  push(audio: Buffer): void;
  close(): void;
}

export interface StreamingTranscriptionPort {
  open(handlers: UtteranceStreamHandlers, lang?: string): Promise<UtteranceStream>;
}

// --- Text to speech ----------------------------------------------------------

export interface SynthesizedSpeech {
  readonly audio: Buffer;
  readonly mimeType: string;
}

export interface SpeechSynthesisPort {
  /** Spoken audio for one agent reply. Audio is an enhancement (ADR-026):
   * the TEXT event is the source of truth and is delivered first.
   * `voice` overrides the configured default — the per-tenant brand voice
   * (ADR-038 Audio Pro); absent → the gateway's default voice. */
  synthesize(text: string, voice?: string): Promise<SynthesizedSpeech>;
  /** Optional streaming form (ADR-032): emits raw audio chunks as the
   * provider produces them — the phone starts speaking ~4x sooner.
   * Resolves when the stream ends; chunk format matches `synthesize`. */
  synthesizeStream?(text: string, onAudio: (chunk: Buffer) => void, voice?: string): Promise<void>;
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

/** One transcript turn for QA retention (ADR-039). */
export interface TranscriptTurn {
  readonly index: number;
  readonly speaker: 'caller' | 'agent';
  readonly text: string;
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
  /** Optional: persist the per-turn transcript for QA review (ADR-039).
   * Best-effort — the engine never blocks session close on it. Idempotent on
   * (session, turn index) at the API. */
  recordTranscript?(sessionId: string, turns: readonly TranscriptTurn[]): Promise<void>;
}
