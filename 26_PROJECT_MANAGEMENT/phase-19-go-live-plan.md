---
project: AURION
document: Phase 19 Go-Live Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-11
related: ADR-016, ADR-020, ADR-027, ADR-028
---

# Phase 19 — Go-live: inteligenciaartificial.pw answers the phone

The stack leaves the laptop. Target: the full compose stack on Daniel's
Hostinger VPS behind `https://inteligenciaartificial.pw` (Caddy TLS), and
the Twilio number **+1 814 936 2930** pointing its `voiceUrl` at the
gateway's signed TwiML endpoint — a real phone call into the
approval-gated engine.

## Work units

1. Signed TwiML endpoint (ADR-028): `POST /twiml` on the gateway
   validates `X-Twilio-Signature` (HMAC-SHA1, constant-time compare,
   public URL pinned in config) and returns the ADR-027 connect snippet.
   Fail-closed config: twilio mode now also requires `TWILIO_AUTH_TOKEN`
   and `TELEPHONY_PUBLIC_URL` (https).
2. Edge: Caddyfile parametrized with `CADDY_DOMAIN` (`:80` default for
   local/CI; the real domain enables automatic TLS) and routes `/twilio`
   + `/twiml` to the gateway.
3. Deployment (runbook `10_DEPLOYMENT/vps-deploy-runbook.md`): Docker on
   the VPS, repo clone, production `.env` with fresh secrets, compose
   `--profile full` up, health checks green over TLS.
4. Twilio cutover: number's `voiceUrl` →
   `https://inteligenciaartificial.pw/twiml` (one REST call), replacing
   the previous vapi.ai experiment.
5. Tests: gateway specs for the TwiML door (signature accept/forge/
   unsigned/GET/off) and contract tests
   `tests/project/test_phase19_golive.py`.

## Acceptance criteria

- [x] `GET /api/v1/health` answers over valid TLS — at
      `https://aurion.srv1321945.hstgr.cloud` (see deployment deviation
      below).
- [x] `POST /twiml` returns the connect TwiML ONLY for Twilio-signed
      requests; unsigned POST → 403, GET → 405 (verified live).
- [x] Calling +1 814 936 2930 reaches the gateway: Daniel called and was
      heard and answered (first with his cloned voice, then switched to
      OpenAI by preference — one `.env` change + gateway restart, exactly
      as ADR-029 promised).
- [x] All suites green in CI; gitleaks clean; no production secret in the
      repo.

## Deployment deviation (discovered live, documented honestly)

The Hostinger VPS is NOT empty: it runs Daniel's Dokploy platform
(Traefik on 80/443 with Let's Encrypt), Supabase, n8n and the agency web
`agenciaia-orionia` — which OWNS the apex `inteligenciaartificial.pw`
and `www.`. Other subdomains (`mc.`, `api.`, `panel.`, `n8n.`, `flow.`,
`evo.`, `engram.`) are also taken.

Resolution: AURION runs from `/root/AURION` with its own compose (core +
dashboard, NO edge profile) behind the EXISTING Traefik via an
uncommitted `docker-compose.override.yml` (dokploy-network + router
labels; host ports bound to loopback). Live host:
`https://aurion.srv1321945.hstgr.cloud` (Hostinger wildcard). The Caddy
edge remains in the repo for clean-VPS deployments.

Pending (Daniel): a DNS A record `aurion.inteligenciaartificial.pw →
76.13.33.228`; then the override labels, `TELEPHONY_PUBLIC_URL` and the
Twilio voiceUrl flip to the branded host (one restart + one API call).

## Known honest exception

Auth runs `hs256` with a strong generated secret at go-live; ADR-016's
production target is `jwks` against a real IdP. This is the FIRST item of
the next operational phase — documented here so it is a decision, not an
accident.

## Out of scope

- IdP real (Auth0/Keycloak) — next phase, first item.
- First real HERMES connector; monitoring/alerts — subsequent phases.
- Outbound calls, DTMF, transfer.

## Closure evidence

Go-live executed 2026-06-11 on Daniel's Hostinger VPS (srv1321945,
8 cores, Ubuntu 25.10, Docker 29.2.1):

- Code merged: PR #33 (`9b4ce74`, TwiML door + edge), PR #34 (`af7e439`,
  compose LLM passthrough — found preparing the production env), PR #36
  (`b5e051c`, telephony accepts the heygen voice — caught FAIL-CLOSED on
  the first production boot, exactly as designed).
- Stack up: postgres (healthy, migrations via one-shot `migrate`), api
  (healthy), hermes-receiver, voice-gateway (`listening on :8080/ws and
  /twilio`, ffmpeg 8.1.1 in image), dashboard. First tenant + admin +
  supervisor seeded; operator tokens delivered out-of-repo.
- Verified live over TLS: health 200, dashboard 200, `/twiml` unsigned
  403 / GET 405.
- Production config: AUTH_MODE=hs256 (documented exception, IdP next),
  BRAIN_MODE=llm (gpt-5.5), STT openai (gpt-4o-transcribe), TTS heygen
  (Daniel's cloned voice, ADR-029), telephony twilio.
- Twilio cutover: +1 814 936 2930 `voiceUrl` →
  `https://aurion.srv1321945.hstgr.cloud/twiml` (POST), replacing the
  previous vapi.ai experiment.
