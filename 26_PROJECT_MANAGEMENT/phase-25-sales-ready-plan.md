---
project: AURION
document: Phase 25 Sales Ready Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: in-progress
created_at: 2026-06-11
related: ADR-034
---

# Phase 25 — Sales ready: the go-to-market checklist

Daniel's question: "¿puedo empezar a vender mediante ads?" The verdict:
demo-driven selling YES today; cold ad traffic to the AI number after
this checklist.

## Work units (code — AURION side)

1. `CallCapacity` cost guard (ADR-034): concurrent + daily caps enforced
   at the TwiML door with a language-aware busy message via Twilio TTS;
   bridge accounting; refusals logged with the meter snapshot.
2. AI disclosure greeting deployed (`PHONE_GREETING` states the caller
   talks to an AI assistant).
3. Contract tests `tests/project/test_phase25_sales_ready.py`.

## Checklist (operator — Daniel side)

- [ ] DKIM for the domain (Google Admin → Gmail → Authenticate email →
      TXT `google._domainkey` at Hostinger DNS) — root cause of mails
      landing in spam (SPF exists; DKIM and DMARC were missing).
- [ ] DMARC TXT `_dmarc`: `v=DMARC1; p=none; rua=mailto:danielgonzalezjunco@gmail.com`.
- [ ] DNS A record `aurion → 76.13.33.228`.
- [ ] Spanish Twilio number (regulatory bundle — start early, takes days).
- [ ] Landing with privacy policy + clear CTA (ads platforms require it);
      recommended funnel v1: ads → "reserva una demo" while the AI line
      hardens with real traffic.
- [ ] Decide ticket destination + WhatsApp sender for the two skeleton
      connectors.

## Acceptance criteria

- [x] A call beyond the concurrent or daily cap hears the busy message
      and costs zero provider spend (verified by test and logs).
- [x] Production greeting discloses the AI (deployed 2026-06-11; cached
      in the operator voice).
- [x] All suites green in CI (PR #49, `ba131e9`; 320 contract, 87
      gateway).

## Closure evidence (code side)

PR #49 squash-merged as `ba131e9` (2026-06-11), all checks green;
deployed the same day with TELEPHONY_MAX_CONCURRENT=4,
TELEPHONY_MAX_CALLS_PER_DAY=200 and the AI-disclosure greeting (warmed
into the greeting cache). The phase stays open on the OPERATOR checklist
above (DKIM/DMARC, DNS record, Spanish number, landing) — those gate the
cold-ads go signal; demo-driven selling is GO since today.
