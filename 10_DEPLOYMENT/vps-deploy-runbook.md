---
project: AURION
document: VPS Deployment Runbook
folder: 10_DEPLOYMENT
owner: Daniel Gonzalez Junco
status: active
created_at: 2026-06-10
related: ADR-003, ADR-016, ADR-020
---

# VPS deployment runbook (Hostinger, single node)

How to put the full AURION stack (`docker-compose.yml`, ADR-020) on a VPS.
Everything fails closed: the stack will not start with an incomplete `.env`.

## 1. Prepare the VPS (once)

```bash
# Ubuntu 24.04 assumed
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER   # re-login afterwards
git clone https://github.com/danielheroiaagen/AURION.git && cd AURION
```

## 2. Write `/AURION/.env` (never committed)

```bash
POSTGRES_PASSWORD=<openssl rand -hex 24>
DATA_ENCRYPTION_KEYS=k1:<openssl rand -base64 32>
HERMES_DISPATCH_SECRET=<openssl rand -hex 24>
VOICE_GATEWAY_CLIENT_KEYS=<openssl rand -hex 24>

# Authentication — production MUST be jwks (ADR-016):
AUTH_MODE=jwks
AUTH_JWKS_URL=https://<idp>/.well-known/jwks.json
JWT_ISSUER=https://<idp>/
JWT_AUDIENCE=aurion-api

# The gateway's machine identity: a voice_agent token issued by the IdP
# (M2M client). With AUTH_MODE=hs256 (staging only) mint it from JWT_SECRET.
VOICE_AGENT_TOKEN=<jwt>
```

Defaults already correct in compose: `ACTION_DISPATCH_MODE=hermes` pointing
at the internal receiver with `HERMES_DISPATCH_ALLOW_INSECURE_HTTP=true` —
acceptable ONLY because the dispatch never leaves the compose network.

## 3. TLS and domain

Edit `docker/Caddyfile`: replace `:80` with the real domain
(`aurion.example.com { ... }`). Caddy provisions and renews Let's Encrypt
certificates automatically; keep ports 80+443 open.

## 4. Bring up

```bash
docker compose --profile full up --build -d
docker compose ps           # everything healthy/running, migrate "exited (0)"
docker compose logs api --tail 50
```

Migrations run as the one-shot `migrate` service (never at app startup).
First tenant + admin membership are seeded by the operator (SQL or the
users API with a platform token) — there is deliberately no auto-seed.

## 5. Updates

```bash
git pull
docker compose --profile full up --build -d   # rebuild changed images only
```

Migrations are forward-only and checksummed; the `migrate` service applies
pending ones before the new API starts.

## 6. Backups

```bash
# Nightly cron:
docker compose exec -T postgres pg_dump -U aurion aurion | gzip > /backups/aurion-$(date +%F).sql.gz
```

Retention per `ADR-015`: retired encryption keys stay escrowed for the full
backup window. Restore = fresh volume + `psql` import + same `.env`.

## 7. Health and evidence

- `GET https://<domain>/api/v1/health` — liveness.
- `docker compose logs -f api hermes-receiver voice-gateway` — flow logs.
- A `dispatch_mode: "noop"` or `connector_mode: "stub"` in PRODUCTION
  audit evidence is an incident signal (ADR-014/ADR-019): the stack is
  running with simulation adapters.
