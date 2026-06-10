import type { SttConfig } from '../config.js';
import type { TranscriptionPort, UtteranceAudio } from '../application/ports.js';

/**
 * OpenAI transcription adapter (ADR-025). Plain fetch + native FormData —
 * no SDK, the gateway's runtime dependency set stays `ws` only.
 *
 * Privacy boundary: the audio buffer goes to the provider and is dropped;
 * only the recognized TEXT flows on. Failures raise TranscriptionError,
 * which the WS layer reports as `stt_failed` — an outage never fabricates
 * a transcript.
 */
export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

interface TranscriptionResponse {
  text?: unknown;
}

export class OpenAiTranscriber implements TranscriptionPort {
  constructor(
    private readonly config: SttConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async transcribe(input: UtteranceAudio): Promise<string> {
    const form = new FormData();
    form.append('model', this.config.model);
    if (input.lang) {
      // BCP 47 tag like "es-ES" → ISO-639-1 "es", the format the endpoint expects.
      form.append('language', input.lang.split('-')[0].toLowerCase());
    }
    form.append(
      'file',
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
      'utterance.webm',
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let parsed: TranscriptionResponse;
    try {
      const response = await this.fetchImpl(`${this.config.apiUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.config.apiKey}` },
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new TranscriptionError(`Transcription endpoint responded ${response.status}.`);
      }
      parsed = (await response.json()) as TranscriptionResponse;
    } catch (error) {
      if (error instanceof TranscriptionError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TranscriptionError(
          `Transcription did not respond within ${this.config.timeoutMs}ms.`,
        );
      }
      throw new TranscriptionError('Transcription endpoint could not be reached.');
    } finally {
      clearTimeout(timer);
    }

    return typeof parsed.text === 'string' ? parsed.text.trim() : '';
  }
}
