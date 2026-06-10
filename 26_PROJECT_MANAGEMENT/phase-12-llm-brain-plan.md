---
project: AURION
document: Phase 12 LLM Brain Adapter Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-10
related: ADR-013, ADR-018, ADR-022
---

# Phase 12 — LLM brain adapter

Phase 12 closes the last open track: a real model behind `AgentBrainPort`
(`ADR-022`). `BRAIN_MODE=llm` talks the OpenAI-compatible Chat Completions
protocol with plain fetch; tool calls map onto the existing approval-gated
action flow — the safety model is untouched by design.

## Work units

1. `ADR-022` and this plan.
2. Gateway config: `llm` mode fail-closed on `LLM_API_URL` / `LLM_API_KEY` /
   `LLM_MODEL`; timeout and token-budget knobs.
3. `infrastructure/llm-brain.ts`: system prompt (role + knowledge titles +
   approval honesty), transcript→messages mapping, two-tool catalog
   mirroring `ACTION_TYPES`, unknown-tool drops, AbortController timeout,
   `BrainError` on any upstream failure (WS layer answers
   `upstream_failed`).
4. Wiring: `main.ts` selects the brain by mode; `.env.example`.
5. Tests: Vitest with mocked fetch (request shape incl. tools + auth header,
   reply mapping, tool-call→intent mapping, unknown-tool drop, malformed
   arguments tolerance, timeout/non-2xx → BrainError, config fail-closed);
   Python contract tests `tests/project/test_phase12_llm_brain.py`.
6. CHANGELOG; phase-program closure notes.

## Acceptance criteria

- [x] `BRAIN_MODE=llm` refuses to boot without endpoint, key, and model;
      `scripted` stays the default (dev/CI/E2E unchanged and deterministic).
- [x] A model tool call becomes a `ToolIntent` for a catalog action type
      ONLY; unknown tools are dropped (tested with a hostile
      `database.drop` tool call).
- [x] Model outages (timeout, non-2xx, malformed body) raise `BrainError` →
      `upstream_failed` — never a fabricated reply or intent.
- [x] Only transcript text and knowledge titles cross the privacy boundary.
- [x] All suites pass locally and in CI with 0 vulnerabilities (local pass
      evidenced below; CI parity pending push).

## Out of scope

- Streaming, audio (speech-to-speech) adapters, per-tenant prompts,
  model fallback chains.

## Closure evidence

Local verification passed on branch `phase-12/llm-brain` (2026-06-10):

- [x] `npm test` passed: **200** Python contract tests (9 new).
- [x] `npm run test:voice-gateway` passed: **20** Vitest tests (7 new LLM
      brain tests).
- [x] Gateway typecheck and build passed.
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Remote verification passed on head `1b5e689` (2026-06-10), PR #26: all
seven checks green on the first round.

Merge evidence: PR #26 squash-merged into `main` as `9d15a61` on 2026-06-10.

**This closes the phase program (0–12).** Every track from the MVP boundary
(ADR-004) and beyond is implemented and verified: multi-tenant API core
with RLS + encryption + audit, human-approval action workflow with real
HMAC-signed dispatch and a receiver, admin dashboard with OIDC PKCE, a
realtime voice gateway with both deterministic and LLM brains, containerized
single-VPS deployment, and an end-to-end CI harness that exercises the full
product loop on every PR. Remaining items are operational (IdP onboarding,
real connectors, VPS go-live) or explicitly deferred by ADR (media server,
per-tenant keys, streaming) — each with its decision record.
