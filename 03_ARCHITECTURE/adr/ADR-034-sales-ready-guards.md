---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-027, ADR-028
---

# ADR-034 — Sales-ready guards: caps before campaigns

## Decision

Before paid traffic points at the phone line, two guards and one
disclosure:

- **`CallCapacity`** — one shared meter, two hard ceilings:
  `TELEPHONY_MAX_CONCURRENT` (default 4) and
  `TELEPHONY_MAX_CALLS_PER_DAY` (default 200, midnight rollover).
  Checked at the **TwiML front door**: an over-limit call is answered by
  Twilio's own TTS with a polite busy message (`<Say>` + `<Hangup/>`,
  language-aware) and **never touches the billed providers** — zero
  OpenAI/HeyGen spend on overflow. The bridge accounts begin/end per
  connection.
- **AI disclosure in the greeting** (operations, not code): the
  production `PHONE_GREETING` states the caller is talking to an AI
  assistant — EU AI Act transparency and basic honesty with future
  customers. The greeting cache (ADR-029) makes the longer text free.

## Context

Daniel asked whether he can start selling through Google/Facebook ads.
The honest audit: the product loop works end to end, but a billed phone
line with no ceilings is an open wallet to ad traffic and bots, and an
undisclosed AI caller is a legal and trust liability in the EU. Caps and
disclosure are the cheap, code-side part of the go-to-market checklist;
deliverability DNS (DKIM/DMARC), a Spanish number and landing/privacy
copy are operator-side and tracked in the phase plan.

## Consequences

- Overflow degrades gracefully and visibly (refusals are logged with the
  meter snapshot); legitimate growth means raising two env numbers.
- The daily counter is in-memory per process: a gateway restart resets
  it. Accepted at this scale — the concurrent cap (the expensive one) is
  instantaneous state anyway.
- Out of scope: per-caller rate limiting, paid-tier quotas per tenant,
  CAPTCHA-like challenges, provider spend APIs.
