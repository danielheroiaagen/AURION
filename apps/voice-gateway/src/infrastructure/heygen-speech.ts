import type { TtsConfig } from '../config.js';
import type { SpeechSynthesisPort, SynthesizedSpeech } from '../application/ports.js';
import { SpeechSynthesisError } from './openai-speech.js';

/**
 * HeyGen speech synthesis adapter (ADR-029): the operator's CLONED voice.
 * Two fetches under one timeout budget — `POST /v3/voices/speech` returns
 * an `audio_url`, which we download. Output is MP3 (`audio/mpeg`); HeyGen
 * offers no format options. No SDK, runtime deps stay `ws` only.
 */
interface SpeechResponse {
  data?: { audio_url?: unknown };
}

export class HeyGenSpeechSynthesizer implements SpeechSynthesisPort {
  constructor(
    private readonly config: TtsConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async synthesize(text: string): Promise<SynthesizedSpeech> {
    const input = text.length > this.config.maxTextChars
      ? text.slice(0, this.config.maxTextChars)
      : text;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let audio: Buffer;
    try {
      const response = await this.fetchImpl(`${this.config.apiUrl}/v3/voices/speech`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: input, voice_id: this.config.voice }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new SpeechSynthesisError(`Speech endpoint responded ${response.status}.`);
      }
      const parsed = (await response.json()) as SpeechResponse;
      const audioUrl = parsed.data?.audio_url;
      if (typeof audioUrl !== 'string' || audioUrl.length === 0) {
        throw new SpeechSynthesisError('Speech endpoint returned no audio url.');
      }
      const download = await this.fetchImpl(audioUrl, { signal: controller.signal });
      if (!download.ok) {
        throw new SpeechSynthesisError(`Speech audio download responded ${download.status}.`);
      }
      audio = Buffer.from(await download.arrayBuffer());
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
    return { audio, mimeType: 'audio/mpeg' };
  }
}
