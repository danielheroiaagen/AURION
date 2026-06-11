/**
 * Agent speech playback (ADR-026). The gateway synthesizes voice
 * server-side; the widget only decodes base64 audio and plays it — no
 * provider call, no key, zero dependencies.
 *
 * Same rule as recorder.ts: every failure is a discriminated result the UI
 * can explain — a lost voice is never silent confusion, the text stands.
 */
export type PlaybackResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unavailable' | 'decode' | 'blocked' };

interface AudioLike {
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play(): Promise<void>;
}

export interface PlayerScope {
  Audio?: new (src: string) => AudioLike;
  URL?: {
    createObjectURL(blob: Blob): string;
    revokeObjectURL(url: string): void;
  };
  atob?: (data: string) => string;
}

export function playbackAvailable(scope: PlayerScope = globalThis as PlayerScope): boolean {
  return (
    typeof scope.Audio === 'function' &&
    typeof scope.URL?.createObjectURL === 'function' &&
    typeof scope.atob === 'function'
  );
}

/** Play one synthesized agent reply; resolves when playback ends or fails. */
export function playAgentAudio(
  audioBase64: string,
  mimeType: string,
  scope: PlayerScope = globalThis as PlayerScope,
): Promise<PlaybackResult> {
  if (!playbackAvailable(scope)) {
    return Promise.resolve({ ok: false, reason: 'unavailable' });
  }

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const binary = scope.atob!(audioBase64);
    bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
  } catch {
    return Promise.resolve({ ok: false, reason: 'decode' });
  }

  const url = scope.URL!.createObjectURL(new Blob([bytes], { type: mimeType }));
  const audio = new scope.Audio!(url);

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: PlaybackResult): void => {
      if (!settled) {
        settled = true;
        scope.URL!.revokeObjectURL(url);
        resolve(result);
      }
    };
    audio.onended = () => settle({ ok: true });
    audio.onerror = () => settle({ ok: false, reason: 'decode' });
    // Autoplay policy: play() rejects when the browser wants a user gesture
    // first — explained, never swallowed.
    audio.play().catch(() => settle({ ok: false, reason: 'blocked' }));
  });
}

export const PLAYBACK_FAILURE_MESSAGES: Record<string, string> = {
  unavailable: 'Este navegador no puede reproducir audio; lee la respuesta en pantalla.',
  decode: 'No se pudo reproducir la voz del agente; lee la respuesta en pantalla.',
  blocked: 'El navegador bloqueó el audio automático. Toca la página y el siguiente turno sonará.',
};

/** Messages for the gateway's TTS error codes (stable per the WS contract). */
export const TTS_ERROR_MESSAGES: Record<string, string> = {
  tts_failed: 'No se pudo generar la voz del agente; lee la respuesta en pantalla.',
};
