#!/usr/bin/env node
/**
 * Local demo bring-up: full compose stack (dashboard + edge included),
 * seeded tenant with realistic data, and ready-to-paste tokens.
 * Usage: node tools/demo/run-demo.mjs
 */
import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';

import pg from 'pg';
import WebSocket from 'ws';

const TENANT_ID = 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb';
const ADMIN_ID = 'bbbbbbbb-2222-4333-8444-cccccccccccc';
const SUPERVISOR_ID = 'cccccccc-3333-4444-8555-dddddddddddd';

const ENV = {
  POSTGRES_PASSWORD: 'demo-postgres-password',
  JWT_SECRET: 'demo-jwt-secret-0123456789abcdef-32chars!',
  DATA_ENCRYPTION_KEYS: `k1:${randomBytes(32).toString('base64')}`,
  HERMES_DISPATCH_SECRET: 'demo-hermes-secret-0123456789abcdef!!',
  VOICE_GATEWAY_CLIENT_KEYS: 'demo-client-key-0123456789abcdef',
  NODE_ENV: 'development',
};

const API = 'http://localhost:3000/api/v1';

// Action ids received over the demo WebSocket are only trusted when they are
// literally UUIDs — anything else never reaches a request URL.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mintToken({ sub, role, actorType, hours = 24 }) {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({
    sub,
    tenant_id: TENANT_ID,
    role,
    actor_type: actorType,
    exp: Math.floor(Date.now() / 1000) + hours * 3600,
  });
  const signature = createHmac('sha256', ENV.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const voiceToken = mintToken({ sub: 'demo-voice-agent', role: null, actorType: 'voice_agent' });
const adminToken = mintToken({ sub: ADMIN_ID, role: 'tenant_admin', actorType: 'user' });
const supervisorToken = mintToken({ sub: SUPERVISOR_ID, role: 'supervisor', actorType: 'user' });
const runEnv = { ...process.env, ...ENV, VOICE_AGENT_TOKEN: voiceToken };

const compose = (args) =>
  spawnSync('docker', ['compose', '--profile', 'full', ...args], { stdio: 'inherit', env: runEnv });

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function waitForApi() {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API}/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('API never became healthy.');
}

async function seed() {
  const client = new pg.Client({
    connectionString: `postgres://aurion:${ENV.POSTGRES_PASSWORD}@localhost:54320/aurion`,
  });
  await client.connect();
  await client.query(
    `INSERT INTO tenants (id, slug, name, settings) VALUES ($1, 'demo', 'Demo Company', '{"sector":"retail"}')
     ON CONFLICT (id) DO NOTHING`,
    [TENANT_ID],
  );
  await client.query(
    `INSERT INTO users (id, email, display_name, status) VALUES
       ($1, 'daniel@demo.test', 'Daniel (Admin)', 'active'),
       ($2, 'sofia@demo.test', 'Sofía (Supervisora)', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [ADMIN_ID, SUPERVISOR_ID],
  );
  await client.query(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES
       ($1, $2, 'tenant_admin'), ($1, $3, 'supervisor')
     ON CONFLICT (tenant_id, user_id) DO NOTHING`,
    [TENANT_ID, ADMIN_ID, SUPERVISOR_ID],
  );
  // Published knowledge for the agent + the dashboard list.
  for (const [title, sha] of [
    ['Pricing FAQ', 'a'.repeat(64)],
    ['Refund policy', 'b'.repeat(64)],
    ['Opening hours', 'c'.repeat(64)],
  ]) {
    await client.query(
      `INSERT INTO knowledge_documents (tenant_id, title, content_sha256, status, published_at)
       VALUES ($1, $2, $3, 'published', now()) ON CONFLICT DO NOTHING`,
      [TENANT_ID, title, sha],
    );
  }
  // A few historical sessions so the Overview has shape.
  await client.query(
    `INSERT INTO voice_sessions (tenant_id, external_session_id, status, summary, outcome, ended_at)
     SELECT $1, 'demo-hist-' || n, 'completed', 'caller: consulta resuelta', 'resolved', now()
     FROM generate_series(1, 4) AS n ON CONFLICT DO NOTHING`,
    [TENANT_ID],
  );
  await client.query(
    `INSERT INTO voice_sessions (tenant_id, external_session_id, status, outcome, ended_at)
     VALUES ($1, 'demo-hist-failed', 'failed', 'connection_dropped', now()) ON CONFLICT DO NOTHING`,
    [TENANT_ID],
  );
  await client.end();
}

/** One scripted WS conversation that leaves a requested action behind. */
function conversation(externalId, text) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `ws://localhost:8080/ws?key=${ENV.VOICE_GATEWAY_CLIENT_KEYS}`,
    );
    let actionId = null;
    const timer = setTimeout(() => reject(new Error('demo conversation timed out')), 30_000);
    socket.on('open', () =>
      socket.send(JSON.stringify({ type: 'session.start', external_session_id: externalId })),
    );
    socket.on('message', (raw) => {
      const event = JSON.parse(raw.toString());
      if (event.type === 'session.started') {
        socket.send(JSON.stringify({ type: 'turn.user', text }));
      }
      if (event.type === 'action.requested' && UUID_RE.test(String(event.action_id))) {
        actionId = String(event.action_id);
      }
      if (event.type === 'turn.agent') {
        socket.send(JSON.stringify({ type: 'session.end', outcome: 'demo' }));
      }
      if (event.type === 'session.ended') {
        clearTimeout(timer);
        socket.close();
        resolve(actionId);
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function main() {
  console.log('› resetting and starting the full stack (dashboard + edge included)…');
  // Always start clean: encryption keys are random per run, so reusing an
  // old volume would leave undecryptable rows behind (fail-closed by design).
  compose(['down', '-v', '--remove-orphans']);
  const up = compose(['up', '--build', '-d']);
  if (up.status !== 0) throw new Error('docker compose up failed');
  await waitForApi();
  console.log('  ✓ API healthy');
  await seed();
  console.log('  ✓ demo tenant, users, knowledge and history seeded');

  // Live workflow data: one executed, one rejected, one awaiting approval.
  const executedId = await conversation('demo-call-1', 'Tengo un problema con mi pedido, abre un ticket');
  if (!executedId) throw new Error('demo-call-1 did not yield a valid action id');
  await api(`/actions/${executedId}/approve`, { method: 'POST', token: supervisorToken });
  await api(`/actions/${executedId}/execute`, { method: 'POST', token: adminToken });

  const rejectedId = await conversation('demo-call-2', 'Quiero cambiar mi cita del jueves');
  if (!rejectedId) throw new Error('demo-call-2 did not yield a valid action id');
  await api(`/actions/${rejectedId}/reject`, { method: 'POST', token: supervisorToken });

  await conversation('demo-call-3', 'Necesito un ticket para una factura duplicada');
  console.log('  ✓ live workflow seeded: 1 executed (real dispatch), 1 rejected, 1 awaiting approval');

  console.log(`
============================================================
  AURION demo is UP
============================================================

  Dashboard ........ http://localhost        (via Caddy edge)
  API .............. http://localhost:3000/api/v1/health
  Voice gateway .... ws://localhost:8080/ws
  Widget (dev) ..... run: npm --workspace @aurion/widget run dev
                     then open http://localhost:5174
                     gateway URL: ws://localhost:8080/ws
                     client key:  ${ENV.VOICE_GATEWAY_CLIENT_KEYS}

  Dashboard sign-in (paste token):

  ADMIN (Daniel):
${adminToken}

  SUPERVISOR (Sofía):
${supervisorToken}

  Stop everything:  docker compose --profile full down -v
============================================================`);
}

main().catch((error) => {
  console.error(`DEMO FAILED: ${error.message}`);
  compose(['logs', '--no-color', '--tail', '40']);
  process.exit(1);
});
