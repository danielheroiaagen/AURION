---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-020, ADR-027
---

# ADR-028 — Signed TwiML endpoint: the phone number's front door

## Decision

The gateway serves the phone number's TwiML itself, at **`POST /twiml`**
on the same HTTP server that routes the WS upgrades — and answers ONLY
requests that carry a valid **`X-Twilio-Signature`** (HMAC-SHA1 of the
public URL plus the sorted form parameters, keyed with the Twilio auth
token, compared in constant time). Everything else gets `403`; the
endpoint does not exist when `TELEPHONY_MODE=off`.

The TwiML it returns is the ADR-027 connect snippet, generated from
config:

```xml
<Response><Connect>
  <Stream url="wss://<TELEPHONY_PUBLIC_URL host>/twilio">
    <Parameter name="key" value="<first VOICE_GATEWAY_CLIENT_KEYS entry>" />
  </Stream>
</Connect></Response>
```

Two new fail-closed settings in twilio mode: **`TWILIO_AUTH_TOKEN`**
(signature validation key) and **`TELEPHONY_PUBLIC_URL`** (the https
origin Twilio reaches us at — the signature is computed over the exact
public URL, so it is configuration, never derived from request headers).

## Context

The TwiML must carry the gateway client key as a `<Parameter>` (ADR-027).
A static TwiML file (Caddy `respond`, a TwiML Bin, an S3 object) would
expose that key to anyone who guesses the URL — the key that gates every
voice session. Twilio signs every webhook request it makes; validating
that signature lets the gateway hand the key ONLY to Twilio.

## Consequences

- Configuring the number is one API call (`voiceUrl =
  https://<domain>/twiml`) and rotating the client key needs no Twilio
  changes — the TwiML is always generated from current config.
- The auth token lives only in the gateway environment (same discipline
  as every other provider secret).
- Anti-pattern avoided: trusting `Host`/`X-Forwarded-*` headers for URL
  reconstruction behind the proxy; the public URL is pinned in config.
- Out of scope: per-call grants in the TwiML (deployment-phase extension
  point in the WS contract), Twilio IP allowlisting (signature is the
  authority).
