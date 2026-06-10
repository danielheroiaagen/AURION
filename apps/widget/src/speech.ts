/**
 * Browser-native speech wrappers (ADR-024). Recognition and synthesis stay
 * LOCAL to the browser — only recognized text crosses the wire. Explicit
 * availability detection: the UI offers the mic only when the platform can
 * listen; otherwise the text fallback is the whole experience.
 *
 * Capture failures are NEVER silent: every outcome is a discriminated
 * result the UI can explain (permission denied, no speech, network).
 */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

export type ListenResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: 'unavailable' | 'not-allowed' | 'no-speech' | 'network' | 'aborted' };

function recognitionConstructor(scope: typeof globalThis = globalThis): RecognitionConstructor | null {
  const candidate =
    (scope as Record<string, unknown>).SpeechRecognition ??
    (scope as Record<string, unknown>).webkitSpeechRecognition;
  return typeof candidate === 'function' ? (candidate as RecognitionConstructor) : null;
}

export function speechInputAvailable(scope: typeof globalThis = globalThis): boolean {
  return recognitionConstructor(scope) !== null;
}

export function speechOutputAvailable(scope: typeof globalThis = globalThis): boolean {
  return 'speechSynthesis' in scope;
}

/** One push-to-talk capture; resolves with the utterance or an explained failure. */
export function listenOnce(
  lang: string,
  scope: typeof globalThis = globalThis,
): Promise<ListenResult> {
  const Recognition = recognitionConstructor(scope);
  if (!Recognition) {
    return Promise.resolve({ ok: false, reason: 'unavailable' });
  }
  return new Promise((resolve) => {
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let settled = false;
    const settle = (result: ListenResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      settle(text ? { ok: true, text } : { ok: false, reason: 'no-speech' });
    };
    recognition.onerror = (event) => {
      const reason =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'not-allowed'
          : event.error === 'network'
            ? 'network'
            : event.error === 'no-speech'
              ? 'no-speech'
              : 'aborted';
      settle({ ok: false, reason });
    };
    // Recognition ended without a result or an error: nothing was heard.
    recognition.onend = () => settle({ ok: false, reason: 'no-speech' });
    recognition.start();
  });
}

export const LISTEN_FAILURE_MESSAGES: Record<string, string> = {
  unavailable: 'Este navegador no soporta reconocimiento de voz; escribe tu mensaje.',
  'not-allowed': 'Permiso de micrófono denegado. Habilítalo en el candado de la barra de direcciones y vuelve a intentar.',
  'no-speech': 'No te he oído. Pulsa el micro y habla tras ver "Listening…".',
  network: 'El reconocimiento de voz del navegador no tiene conexión (Chrome lo procesa online). Escribe tu mensaje o revisa la red.',
  aborted: 'Captura cancelada. Vuelve a pulsar el micro.',
};

export function speak(text: string, lang: string, scope: typeof globalThis = globalThis): void {
  if (!speechOutputAvailable(scope)) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  scope.speechSynthesis.speak(utterance);
}
