/**
 * Conversation state held per live connection (ADR-018). Deliberately thin:
 * the API is the system of record; this is only what the brain needs for
 * context and what the summary is derived from when the session closes.
 */
export interface ConversationTurn {
  readonly index: number;
  readonly speaker: 'caller' | 'agent';
  readonly text: string;
}

export interface RequestedActionRecord {
  readonly actionId: string;
  readonly actionType: string;
  readonly turn: number;
}

export class Conversation {
  private readonly turns: ConversationTurn[] = [];
  private readonly actions: RequestedActionRecord[] = [];
  private userTurnCount = 0;

  addCallerTurn(text: string): number {
    this.userTurnCount += 1;
    this.turns.push({ index: this.turns.length, speaker: 'caller', text });
    return this.userTurnCount;
  }

  addAgentTurn(text: string): void {
    this.turns.push({ index: this.turns.length, speaker: 'agent', text });
  }

  recordAction(record: RequestedActionRecord): void {
    this.actions.push(record);
  }

  get transcript(): readonly ConversationTurn[] {
    return this.turns;
  }

  get requestedActions(): readonly RequestedActionRecord[] {
    return this.actions;
  }

  /**
   * Transcript-derived closing summary. Bounded so the encrypted-at-rest
   * column never receives unbounded payloads; the full audio/transcript
   * belongs to `transcript_uri` storage, not the summary field.
   */
  buildSummary(maxLength = 2000): string {
    const lines = this.turns.map((turn) => `${turn.speaker}: ${turn.text}`);
    if (this.actions.length > 0) {
      lines.push(
        `actions requested: ${this.actions
          .map((action) => `${action.actionType} (${action.actionId})`)
          .join(', ')}`,
      );
    }
    const summary = lines.join('\n');
    return summary.length > maxLength ? `${summary.slice(0, maxLength - 1)}…` : summary;
  }
}
