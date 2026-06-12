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
   * the TEXT event is the source of truth and is delivered first. */
  synthesize(text: string): Promise<SynthesizedSpeech>;
  /** Optional streaming form (ADR-032): emits raw audio chunks as the
   * provider produces them — the phone starts speaking ~4x sooner.
   * Resolves when the stream ends; chunk format matches `synthesize`. */
  synthesizeStream?(text: string, onAudio: (chunk: Buffer) => void): Promise<void>;
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

/** AI-generated insights shape for the post-call summary endpoint (Phase-30). */
export interface PostCallInsights {
  readonly intent?: string;
  readonly caller_name?: string | null;
  readonly callback_number?: string | null;
  readonly lead_quality?: 'hot' | 'warm' | 'cold' | null;
  readonly action_items?: string[];
  readonly language?: string;
}

export interface AurionApiPort {
  /** POST /voice-sessions (idempotent on external_session_id) + transition to active. */
  startSession(externalSessionId: string, callerNumber?: string | null): Promise<StartedSession>;
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
  /**
   * PATCH /voice-sessions/:id/ai-summary (Phase-30).
   * Fire-and-forget safe: caller should not await this for teardown.
   */
  patchAiSummary(
    sessionId: string,
    payload: { ai_summary: string; ai_insights: PostCallInsights },
  ): Promise<void>;
}
