---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-12
related: ADR-011, ADR-017, ADR-018, ADR-022, ADR-028, ADR-031, ADR-038
---

# ADR-039 — Post-call intelligence

<!-- post-call intelligence: feature tag for automated search (Phase-30). -->

## Decision

AURION generates an AI-powered post-call summary and structured insights
for every completed voice session. Generation is asynchronous — it runs
after session close, never blocking socket teardown. The result is stored
encrypted at rest (ADR-011) in the `voice_sessions` table and surfaced in
the dashboard's session detail view.

The feature is additive: all new API fields are nullable, the env var
`POST_CALL_SUMMARY` defaults to `on` only when an LLM is configured, and
existing deployments without an LLM key are unaffected.

## Context

AURION processes real phone calls for business owners. After each call the
operator has no structured data beyond a raw turn-concatenation summary and
an optional outcome string. Post-call intelligence gives them:

- A prose summary of the conversation (max 600 chars, in the call's language).
- Caller intent, lead quality (hot/warm/cold), action items, and caller name
  when mentioned — all generated from the existing conversation turns.
- Caller phone number captured from Twilio's `From` parameter and stored at
  session creation (encrypted, same ADR-011 pattern as `summary`).

The LLM call uses the same OpenAI-compatible endpoint and credentials as
the brain (ADR-022), with a new dedicated system prompt and `max_completion_tokens`
(gpt-5.x API contract — never `max_tokens`).

## Consequences

**Positive**

- Business owners see actionable intelligence immediately after calls land.
- Asynchronous design: `engine.end()` resolves without awaiting the summarizer,
  preserving the existing socket teardown latency.
- `POST_CALL_SUMMARY=off` disables the feature in environments where extra
  LLM latency is undesirable or the LLM key is not configured.
- All personal data (caller number, summary, AI fields) is encrypted at rest
  (ADR-011); no new third parties are introduced — the LLM provider already
  processes the conversation in real time.

**Negative / trade-offs**

- Two extra LLM API calls per completed call (one in-conversation brain call
  already happens; this adds one post-call call). Default token budget:
  `LLM_MAX_TOKENS` (same config). Operator can set `POST_CALL_SUMMARY=off`
  to disable.
- Silent / test calls (zero user turns) are skipped; no tokens are burned for
  them.
- One retry on network/5xx failure, then the session stays without AI fields.
  The session record is always written before the summarizer fires.

## Out of scope

The following are explicitly deferred and must not be built until their
prerequisites are in place:

- **`post_call.notify` auto-notification action**: deferred until (a) n8n
  connectors run in real mode AND (b) a progressive-autonomy policy ADR carves
  auto-approval for low-risk action types. Flagging lead_quality='hot' inside
  ai_insights is sufficient for now.
- **Per-turn transcript table**: the turn-concatenation `summary` field and the
  post-call `ai_summary` together are sufficient; a normalized transcript table
  would require a new migration and a retention policy ADR.
- **Retention policy changes**: `ai_summary`, `ai_insights`, and `caller_number`
  inherit the existing voice_sessions retention rules. A dedicated retention
  policy (legal hold, GDPR erasure, per-tenant TTL) is deferred.

## Privacy note

Caller phone numbers and AI summaries are personal data. They are encrypted
at rest under ADR-011 (AES-256-GCM, application-layer). No new third parties
are introduced: the LLM provider (OpenAI-compatible) already processes the
conversation transcript in real time as part of the brain (ADR-022). The
post-call call sends the same turns; no additional data leaves the system.
