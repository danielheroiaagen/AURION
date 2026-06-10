// Quick live round-trip against the running gateway (reception check).
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080/ws?key=demo-client-key-0123456789abcdef');
const timer = setTimeout(() => {
  console.log('TIMEOUT: sin respuesta del gateway');
  process.exitCode = 1;
  ws.terminate();
}, 15000);

// The expected protocol sequence is tracked locally: each gateway event can
// only advance it one step, and network input never decides the exit path —
// success just closes the socket and lets the process drain.
const script = [
  { expect: 'session.started', send: { type: 'turn.user', text: 'hola, prueba de microfono' } },
  { expect: 'turn.agent', send: { type: 'session.end', outcome: 'test' } },
  { expect: 'session.ended', send: null },
];
let step = 0;

ws.on('open', () =>
  ws.send(JSON.stringify({ type: 'session.start', external_session_id: 'mic-check-1' })),
);
ws.on('message', (raw) => {
  const event = JSON.parse(raw.toString());
  console.log('<<', JSON.stringify(event));
  if (step >= script.length || event.type !== script[step].expect) {
    return;
  }
  const { send } = script[step];
  step += 1;
  if (send) {
    ws.send(JSON.stringify(send));
    return;
  }
  clearTimeout(timer);
  console.log('ROUND-TRIP OK: la recepción funciona');
  process.exitCode = 0;
  ws.close();
});
ws.on('error', (error) => {
  console.log('WS ERROR:', error.message);
  process.exitCode = 1;
  ws.terminate();
});
