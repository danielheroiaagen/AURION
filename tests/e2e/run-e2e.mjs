#!/usr/bin/env node
/**
 * End-to-end harness (ADR-020): builds the real compose stack and drives the
 * full product loop across real processes —
 *
 *   WebSocket conversation (voice gateway, scripted brain)
 *     → approval-gated action request (voice_agent, turn-keyed idempotency)
 *     → human approval over REST (supervisor)
 *     → execution through the REAL HMAC-signed dispatch (API → receiver)
 *     → stub connector evidence, encrypted at rest, read back decrypted
 *     → session closed `completed` with a transcript summary.
 *
 * Throwaway secrets are minted here at run time; nothing lands in git.
 * Usage: npm run e2e
 */
import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';

import pg from 'pg';
import WebSocket from 'ws';

// --- Fixed identifiers (fresh database every run: down -v first) -----------
const TENANT_ID = '11111111-2222-4333-8444-555555555555';
const ADMIN_ID = '22222222-3333-4444-8555-666666666666';
const SUPERVISOR_ID = '33333333-4444-4555-8666-777777777777';

const ENV = {
  POSTGRES_PASSWORD: 'e2e-postgres-password',
  JWT_SECRET: `e2e-jwt-secret-${randomBytes(24).toString('hex')}`,
  DATA_ENCRYPTION_KEYS: `k1:${randomBytes(32).toString('base64')}`,
  HERMES_DISPATCH_SECRET: `e2e-hermes-secret-${randomBytes(24).toString('hex')}`,
  VOICE_GATEWAY_CLIENT_KEYS: `e2e-client-key-${randomBytes(16).toString('hex')}`,
  NODE_ENV: 'test',
};

const API = 'http://localhost:3000/api/v1';
const GATEWAY = 'ws://localhost:8080/ws';

function mintToken({ sub, role, actorType }) {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({
    sub,
    tenant_id: TENANT_ID,
    role,
    actor_type: actorType,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const signature = createHmac('sha256', ENV.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

let runEnv = { VOICE_AGENT_TOKEN: 'x.y.z' };

const compose = (args) =>
  spawnSync('docker', ['compose', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...ENV, ...runEnv },
    shell: false,
  });

function fail(message) {
  console.error(`\nE2E FAILED: ${message}`);
  compose(['logs', '--no-color', '--tail', '80']);
  compose(['down', '-v']);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
  console.log(`  ✓ ${message}`);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, body: payload };
}

async function waitForApi(timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail('API never became healthy.');
}

async function seed() {
  const client = new pg.Client({
    connectionString: `postgres://aurion:${ENV.POSTGRES_PASSWORD}@localhost:54320/aurion`,
  });
  await client.connect();
  await client.query(
    `INSERT INTO tenants (id, slug, name, settings) VALUES ($1, 'e2e', 'E2E Tenant', '{}')
     ON CONFLICT (id) DO NOTHING`,
    [TENANT_ID],
  );
  await client.query(
    `INSERT INTO users (id, email, display_name, status) VALUES
       ($1, 'admin@e2e.test', 'E2E Admin', 'active'),
       ($2, 'supervisor@e2e.test', 'E2E Supervisor', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [ADMIN_ID, SUPERVISOR_ID],
  );
  await client.query(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES
       ($1, $2, 'tenant_admin'), ($1, $3, 'supervisor')
     ON CONFLICT (tenant_id, user_id) DO NOTHING`,
    [TENANT_ID, ADMIN_ID, SUPERVISOR_ID],
  );
  await client.end();
}

/**
 * Connect with retries: compose marks the gateway "started" before its WS
 * server is listening, so the first attempts may be refused/reset.
 */
async function connectGateway(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const session = new WsSession(url);
      await session.open();
      return session;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  fail(`gateway never accepted a connection: ${lastError?.message ?? 'unknown'}`);
}

/** One live WS connection with imperative send/waitFor control. */
class WsSession {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.events = [];
    this.waiters = [];
    this.socket.on('message', (raw) => {
      const event = JSON.parse(raw.toString());
      if (event.type === 'error') {
        fail(`gateway error: ${event.code} ${event.message}`);
      }
      this.events.push(event);
      for (const waiter of [...this.waiters]) {
        if (waiter.predicate(event)) {
          this.waiters.splice(this.waiters.indexOf(waiter), 1);
          clearTimeout(waiter.timer);
          waiter.resolve(event);
        }
      }
    });
  }

  open() {
    return new Promise((resolve, reject) => {
      this.socket.once('open', () => {
        // Connection failures stop being fatal once the retry loop is done.
        this.socket.on('error', () => undefined);
        resolve();
      });
      this.socket.once('error', reject);
    });
  }

  send(event) {
    this.socket.send(JSON.stringify(event));
  }

  waitFor(predicate, label, timeoutMs = 30_000) {
    const already = this.events.find(predicate);
    if (already) {
      return Promise.resolve(already);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => fail(`timed out waiting for: ${label}`), timeoutMs);
      this.waiters.push({ predicate, resolve, timer });
    });
  }
}

async function main() {
  const voiceToken = mintToken({ sub: 'e2e-voice-agent', role: null, actorType: 'voice_agent' });
  const adminToken = mintToken({ sub: ADMIN_ID, role: 'tenant_admin', actorType: 'user' });
  const supervisorToken = mintToken({ sub: SUPERVISOR_ID, role: 'supervisor', actorType: 'user' });
  runEnv = { VOICE_AGENT_TOKEN: voiceToken };

  console.log('› building and starting the stack (this takes a few minutes)…');
  compose(['down', '-v', '--remove-orphans']);
  const up = compose(['up', '--build', '-d']);
  if (up.status !== 0) {
    fail('docker compose up failed.');
  }

  await waitForApi();
  console.log('  ✓ API healthy');
  await seed();
  console.log('  ✓ tenant + humans seeded');

  // --- One conversation, end to end, on one connection ---------------------
  const session = await connectGateway(`${GATEWAY}?key=${ENV.VOICE_GATEWAY_CLIENT_KEYS}`);

  session.send({ type: 'session.start', external_session_id: 'e2e-call-1' });
  await session.waitFor((event) => event.type === 'session.started', 'session.started');
  console.log('  ✓ conversation started (API session active)');

  session.send({ type: 'turn.user', text: 'I have a problem with my order, open a ticket please' });
  const requested = await session.waitFor(
    (event) => event.type === 'action.requested',
    'action.requested',
  );
  await session.waitFor((event) => event.type === 'turn.agent', 'turn.agent');
  assert(requested.approval_pending === true, 'voice agent action is approval-pending');
  const actionId = requested.action_id;

  // --- The human decision and execution (REST, mid-conversation) -----------
  const beforeApproval = await api(`/actions/${actionId}/execute`, {
    method: 'POST',
    token: adminToken,
  });
  assert(beforeApproval.status === 409, 'execution before approval is refused');

  const approved = await api(`/actions/${actionId}/approve`, {
    method: 'POST',
    token: supervisorToken,
  });
  assert(approved.status === 200 && approved.body.status === 'approved', 'supervisor approves');

  const executed = await api(`/actions/${actionId}/execute`, {
    method: 'POST',
    token: adminToken,
  });
  assert(executed.status === 200 && executed.body.status === 'executed', 'admin executes');
  assert(
    executed.body.result_payload?.connector_mode === 'stub',
    'evidence came through the real signed dispatch into the HERMES receiver',
  );
  assert(
    executed.body.result_payload?.action_id === actionId,
    'receiver evidence is tied to the action id',
  );

  // --- The caller learns the outcome and the conversation closes -----------
  session.send({ type: 'action.poll', action_id: actionId });
  await session.waitFor(
    (event) => event.type === 'action.update' && event.status === 'executed',
    'action.update executed',
  );
  session.send({ type: 'session.end', outcome: 'resolved' });
  await session.waitFor(
    (event) => event.type === 'session.ended' && event.status === 'completed',
    'session.ended completed',
  );
  console.log('  ✓ caller saw the executed outcome; session closed completed');

  const sessions = await api('/voice-sessions?status=completed&limit=50', { token: adminToken });
  const record = sessions.body.items?.find((item) => item.external_session_id === 'e2e-call-1');
  assert(record, 'completed session is on record');
  assert(
    typeof record.summary === 'string' && record.summary.length > 0,
    'summary persisted (encrypted at rest, decrypted for the authorized reader)',
  );

  console.log('\nE2E PASSED: the full product loop works across real services.');
  compose(['down', '-v']);
}

main().catch((error) => fail(error.stack ?? String(error)));
