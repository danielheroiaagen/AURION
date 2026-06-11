#!/usr/bin/env node
/**
 * Hostinger DNS tool (phase 25 operator checklist). Zero dependencies.
 *
 * Manages the domain zone through the official Hostinger API
 * (https://developers.hostinger.com) — the VPS has no authority over
 * DNS; the API token does. Create one in hPanel → Account → API.
 *
 * Usage:
 *   HOSTINGER_API_TOKEN=... node tools/dns/hostinger-dns.mjs list <domain>
 *   HOSTINGER_API_TOKEN=... node tools/dns/hostinger-dns.mjs upsert <domain> <type> <name> <content> [ttl]
 *
 * Examples (the phase 25 records):
 *   ... upsert inteligenciaartificial.pw TXT _dmarc "v=DMARC1; p=none; rua=mailto:danielgonzalezjunco@gmail.com"
 *   ... upsert inteligenciaartificial.pw TXT google._domainkey "v=DKIM1; k=rsa; p=MIIB..."
 *   ... upsert inteligenciaartificial.pw A aurion 76.13.33.228
 */
const BASE = 'https://developers.hostinger.com/api/dns/v1';

const token = process.env.HOSTINGER_API_TOKEN;
if (!token) {
  console.error('HOSTINGER_API_TOKEN is required (hPanel → Account → API).');
  process.exit(1);
}

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`${method} ${path} → ${response.status}`);
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }
  return payload;
}

const [command, domain, type, name, content, ttl] = process.argv.slice(2);

if (command === 'list' && domain) {
  const zone = await call('GET', `/zones/${domain}`);
  for (const entry of Array.isArray(zone) ? zone : (zone?.zone ?? [])) {
    const values = (entry.records ?? []).map((record) => record.content).join(' | ');
    console.log(`${(entry.type ?? '?').padEnd(6)} ${(entry.name ?? '@').padEnd(28)} ttl=${entry.ttl ?? '-'}  ${values}`);
  }
  process.exit(0);
}

if (command === 'upsert' && domain && type && name && content) {
  await call('PUT', `/zones/${domain}`, {
    overwrite: false,
    zone: [
      {
        name,
        type: type.toUpperCase(),
        ttl: ttl ? Number.parseInt(ttl, 10) : 3600,
        records: [{ content }],
      },
    ],
  });
  console.log(`upserted ${type.toUpperCase()} ${name}.${domain} → ${content.slice(0, 60)}…`);
  process.exit(0);
}

console.error('Usage: list <domain> | upsert <domain> <type> <name> <content> [ttl]');
process.exit(1);
