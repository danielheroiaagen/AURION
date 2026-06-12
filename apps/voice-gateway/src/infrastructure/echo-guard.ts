/**
 * Echo guard (ADR-038, barge-in v2). The phone line transcribes the agent's
 * OWN voice as caller speech — a ghost turn — especially the clipped TAIL
 * left in flight when a caller barges in. The guard remembers a short window
 * of what the agent recently said and drops anything that is plainly an echo
 * of it, while staying conservative enough never to swallow a real turn.
 */

/** Recent agent lines kept for matching (greeting + fillers + replies). */
const ECHO_WINDOW = 4;
/** Substring rule: ignore echoes shorter than this (too little to be sure). */
const MIN_ECHO_CHARS = 8;
/** Overlap rule: a tail needs at least this many words to be judged. */
const MIN_OVERLAP_TOKENS = 3;
/** ... and this share of them must be drawn from recent agent speech. */
const ECHO_OVERLAP_RATIO = 0.8;

/** Accent/punctuation-insensitive, whitespace-collapsed comparison form. */
export function normalizeForEcho(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class EchoGuard {
  /** Normalized recent agent lines, oldest first, bounded to the window. */
  private readonly recent: string[] = [];

  constructor(private readonly window: number = ECHO_WINDOW) {}

  /** Record something the agent just voiced so its echo can be recognized. */
  remember(text: string): void {
    const normalized = normalizeForEcho(text);
    if (normalized.length === 0) {
      return;
    }
    this.recent.push(normalized);
    while (this.recent.length > this.window) {
      this.recent.shift();
    }
  }

  /** Is the heard text an echo of recent agent speech? */
  isEcho(heard: string): boolean {
    const normalized = normalizeForEcho(heard);
    if (normalized.length === 0) {
      return false;
    }
    // Rule 1 (high precision): the whole utterance is a substring of
    // something we recently said.
    if (
      normalized.length >= MIN_ECHO_CHARS &&
      this.recent.some((line) => line.includes(normalized))
    ) {
      return true;
    }
    // Rule 2 (noisy tails): most of the heard words are drawn from recent
    // agent speech — catches a clipped barge-in tail the STT mangled, while
    // a real reply that merely shares a word or two survives.
    const tokens = normalized.split(' ').filter((token) => token.length > 0);
    if (tokens.length < MIN_OVERLAP_TOKENS) {
      return false;
    }
    const vocabulary = new Set(this.recent.join(' ').split(' '));
    const drawn = tokens.filter((token) => vocabulary.has(token)).length;
    return drawn / tokens.length >= ECHO_OVERLAP_RATIO;
  }
}
