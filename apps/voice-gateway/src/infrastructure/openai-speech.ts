import type { TtsConfig } from '../config.js';
import type { SpeechSynthesisPort, SynthesizedSpeech } from '../application/ports.js';

/**
 * OpenAI speech synthesis adapter (ADR-026). Plain fetch + JSON — no SDK,
 * the gateway's runtime dependency set stays `ws` only.
 *
 * The reply TEXT has already been delivered when this runs: failures raise
 * SpeechSynthesisError, which the WS layer reports as `tts_failed` — a
 * provider outage costs the voice, never the answer.
 */
export class SpeechSynthesisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechSynthesisError';
  }
}

export type SpeechFormat = 'mp3' | 'pcm';

export class OpenAiSpeechSynthesizer implements SpeechSynthesisPort {
  constructor(
    private readonly config: TtsConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    /** `pcm` (16-bit LE, 24 kHz) feeds the telephony transcode (ADR-027). */
    private readonly format: SpeechFormat = 'mp3',
  ) {}

  async synthesize(text: string, voice?: string): Promise<SynthesizedSpeech> {
    // The cap bounds per-reply provider cost; a truncated voice line still
    // ends on the full text the caller can read.
    const input = text.length > this.config.maxTextChars
      ? text.slice(0, this.config.maxTextChars)
      : text;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let audio: Buffer;
    try {
      const response = await this.fetchImpl(`${this.config.apiUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          voice: voice || this.config.voice,
          input,
          response_format: this.format,
          ...(this.config.speed !== 1 ? { speed: this.config.speed } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new SpeechSynthesisError(`Speech endpoint responded ${response.status}.`);
      }
      audio = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof SpeechSynthesisError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SpeechSynthesisError(
          `Speech synthesis did not respond within ${this.config.timeoutMs}ms.`,
        );
      }
      throw new SpeechSynthesisError('Speech endpoint could not be reached.');
    } finally {
      clearTimeout(timer);
    }

    if (audio.length === 0) {
      throw new SpeechSynthesisError('Speech endpoint returned no audio.');
    }
    return { audio, mimeType: this.format === 'pcm' ? 'audio/pcm;rate=24000' : 'audio/mpeg' };
  }

  /** Streaming synthesis (ADR-032, pcm format only): chunks reach `onAudio`
   * as the provider renders them — the phone starts speaking ~4x sooner. */
  async synthesizeStream(
    text: string,
    onAudio: (chunk: Buffer) => void,
    voice?: string,
  ): Promise<void> {
    if (this.format !== 'pcm') {
      throw new SpeechSynthesisError('Streaming synthesis is only wired for the pcm format.');
    }
    const input = text.length > this.config.maxTextChars
      ? text.slice(0, this.config.maxTextChars)
      : text;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.apiUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          voice: voice || this.config.voice,
          input,
          response_format: 'pcm',
          ...(this.config.speed !== 1 ? { speed: this.config.speed } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new SpeechSynthesisError(`Speech endpoint responded ${response.status}.`);
      }
      let received = 0;
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        received += chunk.length;
        onAudio(Buffer.from(chunk));
      }
      if (received === 0) {
        throw new SpeechSynthesisError('Speech endpoint returned no audio.');
      }
    } catch (error) {
      if (error instanceof SpeechSynthesisError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SpeechSynthesisError(
          `Speech synthesis did not respond within ${this.config.timeoutMs}ms.`,
        );
      }
      throw new SpeechSynthesisError('Speech endpoint could not be reached.');
    } finally {
      clearTimeout(timer);
    }
  }
}
