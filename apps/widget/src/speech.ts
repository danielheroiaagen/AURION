/**
 * Browser-native speech wrappers (ADR-024). Recognition and synthesis stay
 * LOCAL to the browser — only recognized text crosses the wire. Explicit
 * availability detection: the UI offers the mic only when the platform can
 * listen; otherwise the text fallback is the whole experience.
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

/** One push-to-talk capture; resolves with the recognized utterance. */
export function listenOnce(
  lang: string,
  scope: typeof globalThis = globalThis,
): Promise<string | null> {
  const Recognition = recognitionConstructor(scope);
  if (!Recognition) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let settled = false;
    const settle = (value: string | null): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    recognition.onresult = (event) => settle(event.results[0]?.[0]?.transcript ?? null);
    recognition.onerror = () => settle(null);
    recognition.onend = () => settle(null);
    recognition.start();
  });
}

export function speak(text: string, lang: string, scope: typeof globalThis = globalThis): void {
  if (!speechOutputAvailable(scope)) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  scope.speechSynthesis.speak(utterance);
}
