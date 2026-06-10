import { ConversationClient } from './conversation-client';
import type { ServerEvent } from './protocol';
import {
  RECORD_FAILURE_MESSAGES,
  STT_ERROR_MESSAGES,
  recordingAvailable,
  startRecording,
  type ActiveRecording,
} from './recorder';
import {
  LISTEN_FAILURE_MESSAGES,
  listenOnce,
  speak,
  speechInputAvailable,
  speechOutputAvailable,
} from './speech';
import './styles.css';

/**
 * Minimal call UI (ADR-024): connect → talk (mic push-to-talk when the
 * platform can listen, text always) → see actions await human approval →
 * end. Vanilla DOM, zero dependencies.
 *
 * Mic capture prefers gateway STT (ADR-025): record locally, transcribe
 * server-side. The browser's online recognizer is only the fallback when
 * the gateway reports stt_enabled: false.
 */
const LANG = navigator.language || 'es-ES';
const root = document.getElementById('aurion-widget')!;

root.innerHTML = `
  <div class="aw-card">
    <div class="aw-header">AURION</div>
    <form class="aw-setup">
      <label>Gateway WebSocket URL
        <input name="url" value="ws://localhost:8080/ws" required />
      </label>
      <label>Client key
        <input name="key" type="password" required minlength="16" />
      </label>
      <button type="submit" class="aw-primary">Start call</button>
    </form>
    <div class="aw-call" hidden>
      <div class="aw-transcript" aria-live="polite"></div>
      <div class="aw-actions"></div>
      <form class="aw-compose">
        <input name="text" placeholder="Escribe o pulsa el micro…" autocomplete="off" />
        <button type="button" class="aw-mic" title="Push to talk" hidden>🎙</button>
        <button type="submit">Send</button>
      </form>
      <button type="button" class="aw-end">End call</button>
      <div class="aw-status" aria-live="polite"></div>
    </div>
  </div>
`;

const setup = root.querySelector<HTMLFormElement>('.aw-setup')!;
const call = root.querySelector<HTMLElement>('.aw-call')!;
const transcript = root.querySelector<HTMLElement>('.aw-transcript')!;
const actions = root.querySelector<HTMLElement>('.aw-actions')!;
const compose = root.querySelector<HTMLFormElement>('.aw-compose')!;
const micButton = root.querySelector<HTMLButtonElement>('.aw-mic')!;
const endButton = root.querySelector<HTMLButtonElement>('.aw-end')!;
const status = root.querySelector<HTMLElement>('.aw-status')!;

let client: ConversationClient | null = null;
let gatewayStt = false;
let recording: ActiveRecording | null = null;

function line(speaker: 'caller' | 'agent', text: string): void {
  const element = document.createElement('p');
  element.className = `aw-line aw-${speaker}`;
  element.textContent = text;
  transcript.append(element);
  transcript.scrollTop = transcript.scrollHeight;
}

function actionChip(actionId: string, actionType: string): void {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'aw-chip';
  chip.dataset.actionId = actionId;
  chip.textContent = `${actionType}: awaiting human approval — check status`;
  chip.addEventListener('click', () => client?.pollAction(actionId));
  actions.append(chip);
}

function handleEvent(event: ServerEvent): void {
  switch (event.type) {
    case 'session.started':
      status.textContent = 'Connected. The agent is listening.';
      gatewayStt = event.stt_enabled === true && recordingAvailable();
      micButton.hidden = !gatewayStt && !speechInputAvailable();
      break;
    case 'audio.transcript':
      // The gateway's echo of what it heard (ADR-025). Empty = nothing heard.
      if (event.text) {
        status.textContent = '';
        line('caller', event.text);
      } else {
        status.textContent = LISTEN_FAILURE_MESSAGES['no-speech'];
      }
      break;
    case 'turn.agent':
      line('agent', event.text);
      if (speechOutputAvailable()) {
        speak(event.text, LANG);
      }
      break;
    case 'action.requested':
      // Honesty rule carried to the caller (ADR-013/ADR-024): registered,
      // pending a human decision — never claimed as done.
      actionChip(event.action_id, event.action_type);
      break;
    case 'action.update': {
      const chip = actions.querySelector<HTMLElement>(`[data-action-id="${event.action_id}"]`);
      if (chip) {
        chip.textContent = `${event.action_id.slice(0, 8)}…: ${event.status}`;
      }
      break;
    }
    case 'session.ended':
      status.textContent = `Call ended (${event.status}). Thank you.`;
      client?.disconnect();
      break;
    case 'error':
      status.textContent = STT_ERROR_MESSAGES[event.code] ?? `Problem: ${event.message}`;
      if (event.code === 'stt_disabled') {
        // The gateway cannot listen after all: fall back honestly.
        gatewayStt = false;
        micButton.hidden = !speechInputAvailable();
      }
      break;
  }
}

setup.addEventListener('submit', (submitEvent) => {
  submitEvent.preventDefault();
  const data = new FormData(setup);
  client = new ConversationClient(
    {
      gatewayUrl: String(data.get('url')),
      clientKey: String(data.get('key')),
    },
    {
      onEvent: handleEvent,
      onClose: () => {
        status.textContent ||= 'Disconnected.';
      },
    },
  );
  client
    .connect()
    .then(() => {
      setup.hidden = true;
      call.hidden = false;
      // Provisional until session.started reports whether the gateway listens.
      micButton.hidden = !recordingAvailable() && !speechInputAvailable();
    })
    .catch((error: Error) => {
      status.textContent = error.message;
    });
});

compose.addEventListener('submit', (submitEvent) => {
  submitEvent.preventDefault();
  const input = compose.elements.namedItem('text') as HTMLInputElement;
  const text = input.value.trim();
  if (text && client) {
    line('caller', text);
    client.sendTurn(text);
    input.value = '';
  }
});

function listenLocally(): void {
  micButton.disabled = true;
  status.textContent = 'Listening… habla ahora';
  void listenOnce(LANG).then((result) => {
    micButton.disabled = false;
    if (result.ok && client) {
      status.textContent = '';
      line('caller', result.text);
      client.sendTurn(result.text);
      return;
    }
    // Capture failures are never silent (ADR-024): explain and offer the
    // text fallback — same conversation, same protocol.
    if (!result.ok) {
      status.textContent = LISTEN_FAILURE_MESSAGES[result.reason] ?? 'No se pudo capturar audio.';
    }
  });
}

/** Gateway STT (ADR-025): first press records, second press sends. */
async function recordForGateway(): Promise<void> {
  if (recording) {
    const active = recording;
    recording = null;
    micButton.classList.remove('aw-recording');
    status.textContent = 'Transcribiendo…';
    active.stop();
    const result = await active.result;
    if (!result.ok) {
      status.textContent = RECORD_FAILURE_MESSAGES[result.reason] ?? 'No se pudo grabar audio.';
      return;
    }
    client?.sendUtterance(result.audioBase64, result.mimeType, LANG);
    return;
  }
  const started = await startRecording();
  if (!started.ok) {
    status.textContent = RECORD_FAILURE_MESSAGES[started.reason] ?? 'No se pudo grabar audio.';
    return;
  }
  recording = started;
  micButton.classList.add('aw-recording');
  status.textContent = 'Grabando… pulsa el micro otra vez para enviar.';
}

micButton.addEventListener('click', () => {
  if (gatewayStt) {
    void recordForGateway();
    return;
  }
  listenLocally();
});

endButton.addEventListener('click', () => {
  client?.end('caller_ended');
});
