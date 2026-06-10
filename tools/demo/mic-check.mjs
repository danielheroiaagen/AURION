// Quick live round-trip against the running gateway (reception check).
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080/ws?key=demo-client-key-0123456789abcdef');
const timer = setTimeout(() => {
  console.log('TIMEOUT: sin respuesta del gateway');
  process.exit(1);
}, 15000);

ws.on('open', () =>
  ws.send(JSON.stringify({ type: 'session.start', external_session_id: 'mic-check-1' })),
);
ws.on('message', (raw) => {
  const event = JSON.parse(raw.toString());
  console.log('<<', JSON.stringify(event));
  if (event.type === 'session.started') {
    ws.send(JSON.stringify({ type: 'turn.user', text: 'hola, prueba de microfono' }));
  }
  if (event.type === 'turn.agent') {
    ws.send(JSON.stringify({ type: 'session.end', outcome: 'test' }));
  }
  if (event.type === 'session.ended') {
    clearTimeout(timer);
    console.log('ROUND-TRIP OK: la recepción funciona');
    process.exit(0);
  }
});
ws.on('error', (error) => {
  console.log('WS ERROR:', error.message);
  process.exit(1);
});
