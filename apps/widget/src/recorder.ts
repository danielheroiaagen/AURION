/**
 * Push-to-talk audio capture (ADR-025). Recording is LOCAL
 * (`getUserMedia` + `MediaRecorder` — no online recognizer involved); the
 * utterance ships to the gateway, which owns transcription server-side.
 *
 * Same rule as speech.ts: every failure is a discriminated result the UI
 * can explain — capture problems are never silent.
 */
export type RecordingResult =
  | { readonly ok: true; readonly audioBase64: string; readonly mimeType: string }
  | { readonly ok: false; readonly reason: 'unavailable' | 'not-allowed' | 'no-audio' };

export interface ActiveRecording {
  readonly ok: true;
  /** Stop capturing and settle `result`. */
  stop(): void;
  readonly result: Promise<RecordingResult>;
}

export type RecordingStart =
  | ActiveRecording
  | { readonly ok: false; readonly reason: 'unavailable' | 'not-allowed' };

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const MAX_RECORDING_MS = 15_000;

interface MediaRecorderLike {
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start(): void;
  stop(): void;
  state: string;
}

interface RecorderScope {
  navigator?: { mediaDevices?: { getUserMedia(c: { audio: boolean }): Promise<MediaStream> } };
  MediaRecorder?: {
    new (stream: MediaStream, options?: { mimeType?: string }): MediaRecorderLike;
    isTypeSupported?(mime: string): boolean;
  };
}

export function recordingAvailable(scope: RecorderScope = globalThis as RecorderScope): boolean {
  return (
    typeof scope.MediaRecorder === 'function' &&
    typeof scope.navigator?.mediaDevices?.getUserMedia === 'function'
  );
}

function pickMimeType(scope: RecorderScope): string {
  const supported = scope.MediaRecorder?.isTypeSupported;
  if (typeof supported === 'function') {
    for (const mime of MIME_CANDIDATES) {
      if (supported.call(scope.MediaRecorder, mime)) {
        return mime;
      }
    }
  }
  return '';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Ask for the mic and start one capture; stops itself after 15 s. */
export async function startRecording(
  scope: RecorderScope = globalThis as RecorderScope,
): Promise<RecordingStart> {
  if (!recordingAvailable(scope)) {
    return { ok: false, reason: 'unavailable' };
  }
  let stream: MediaStream;
  try {
    stream = await scope.navigator!.mediaDevices!.getUserMedia({ audio: true });
  } catch {
    return { ok: false, reason: 'not-allowed' };
  }

  const mimeType = pickMimeType(scope);
  const recorder = new scope.MediaRecorder!(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const result = new Promise<RecordingResult>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) {
        resolve({ ok: false, reason: 'no-audio' });
        return;
      }
      void blobToBase64(blob).then((audioBase64) =>
        resolve({ ok: true, audioBase64, mimeType: type }),
      );
    };
  });

  let timer: ReturnType<typeof setTimeout>;
  const stop = (): void => {
    clearTimeout(timer);
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };
  timer = setTimeout(stop, MAX_RECORDING_MS);

  recorder.start();
  return { ok: true, stop, result };
}

export const RECORD_FAILURE_MESSAGES: Record<string, string> = {
  unavailable: 'Este navegador no puede grabar audio; escribe tu mensaje.',
  'not-allowed':
    'Permiso de micrófono denegado. Habilítalo en el candado de la barra de direcciones y vuelve a intentar.',
  'no-audio': 'No se grabó nada. Pulsa el micro, habla, y pulsa otra vez para enviar.',
};

/** Messages for the gateway's STT error codes (stable per the WS contract). */
export const STT_ERROR_MESSAGES: Record<string, string> = {
  stt_disabled: 'Este gateway no tiene transcripción configurada; escribe tu mensaje.',
  audio_too_large: 'La grabación es demasiado larga. Prueba con una frase más corta.',
  stt_failed: 'No se pudo transcribir el audio. Vuelve a intentarlo o escribe tu mensaje.',
};
