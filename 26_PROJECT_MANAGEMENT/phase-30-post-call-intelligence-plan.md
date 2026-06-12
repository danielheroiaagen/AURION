---
project: AURION
document: Phase 30 Post-Call Intelligence Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: implemented
created_at: 2026-06-12
related: ADR-039
---

# Phase 30 — Post-call intelligence

## Goal

Give business owners structured, actionable intelligence after every voice call:
a prose AI summary, lead quality classification, intent detection, and caller
metadata — all generated asynchronously without blocking call teardown.

## Work units

1. **Migration** (`2026-06-12-0001`): add `caller_number`, `ai_summary`, and
   `ai_insights` nullable TEXT columns to `voice_sessions`; encrypted at rest
   using the ADR-011 pattern.
2. **API service**: extend `POST /voice-sessions` to accept optional
   `caller_number`; add `PATCH /voice-sessions/:id/ai-summary` endpoint
   (terminal sessions only, idempotent, `conversation:write`); expose new fields
   in GET responses; regenerate `openapi.json`.
3. **Voice gateway**: forward Twilio's `From` param as a `<Parameter name="caller">`
   in the TwiML `<Stream>`; parse it in `twilio-protocol.ts`; thread it to
   `AurionApiClient.startSession`. Add `PostCallSummarizer` application service
   that calls the LLM (same endpoint/config as the brain, `max_completion_tokens`,
   no tools, no `response_format`) and returns a structured JSON result. Wire
   fire-and-forget post-close summarization in `ConversationEngine`. Add
   `POST_CALL_SUMMARY` env var (defaults `on` when LLM configured).
4. **Dashboard**: extend `VoiceSessionResponse` types; add `getVoiceSession`
   resource; add Caller column to sessions list with row links; new
   `/sessions/:id` route and `SessionDetailPage` with AI summary card, insights,
   and collapsed raw transcript notes.
5. **Docs & meta**: ADR-039, phase plan, CHANGELOG entry, Python project tests.

## Acceptance criteria

- [x] Migration files exist and add all three columns.
- [x] `PATCH /voice-sessions/:id/ai-summary` is registered and documented in
      `openapi.json`.
- [x] `caller_number` flows from Twilio `From` → TwiML `<Parameter>` → start
      frame → session create body.
- [x] `ConversationEngine.end()` resolves without awaiting the summarizer (unit
      test verifies this).
- [x] `PostCallSummarizer` skips silent calls (zero user turns) and returns null.
- [x] Dashboard sessions list shows Caller column and links to detail.
- [x] Session detail page shows AI summary, insights, lead quality badge, action
      items, and a collapsed raw transcript notes block.
- [x] `npm run typecheck`, `npm run lint`, and `npm run test:project` all pass.

## Follow-ups

- Wire `post_call.notify` action type after n8n connectors are validated in real
  mode and a progressive-autonomy ADR approves auto-actions for low-risk types
  (ADR-039 "Out of scope").
- Add retention policy and GDPR erasure path for `caller_number` and AI fields.
- Consider per-tenant `POST_CALL_SUMMARY` toggle once the settings schema is
  extended for per-feature flags.
