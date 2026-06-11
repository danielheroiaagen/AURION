---
project: AURION
document: Phase 19 Go-Live Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
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

- [ ] `GET https://inteligenciaartificial.pw/api/v1/health` answers over
      valid TLS.
- [ ] `POST /twiml` returns the connect TwiML ONLY for Twilio-signed
      requests; forged/unsigned/GET requests are refused (403/405).
- [ ] Calling +1 814 936 2930 reaches the gateway: greeting heard,
      conversation recorded as a voice session in the API, actions
      approval-gated.
- [ ] All suites green in CI; gitleaks clean; no production secret in the
      repo.

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

To be completed at phase close.
