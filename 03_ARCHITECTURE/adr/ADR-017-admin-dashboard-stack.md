---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-006, ADR-009, ADR-013, ADR-016
---

# ADR-017 — Admin dashboard stack

## Decision

The AURION admin dashboard is a **client-side SPA**: Vite + React +
TypeScript, living in the monorepo at `apps/dashboard`, deployed as static
assets, talking to the backend exclusively through the versioned REST API
(`/api/v1`, ADR-009) with a bearer token.

Stack constraints, in the same spirit as the backend's "minimal supply
chain" rule:

- **No SSR framework.** An internal admin tool has no SEO or first-paint
  requirement that justifies a server runtime; static hosting removes an
  entire deployment surface.
- **No UI kit, no CSS framework.** A small hand-owned stylesheet; the
  dependency tree stays auditable (react, react-dom, react-router-dom — and
  nothing else at runtime).
- **No API codegen.** The TypeScript API client is hand-written against the
  committed `32_API_REFERENCE/openapi.json`; response types mirror the
  documented snake_case shapes. The OpenAPI drift check (phase 6) keeps the
  reference honest; a contract test keeps the client's types in the repo's
  review flow.

## Context

The PRD requires a control panel: administrators upload knowledge and define
what the agent may do; supervisors review conversations and metrics. The
backend's human-approval workflow (ADR-013) has no human surface yet — the
core product promise ("a conversation can safely act, with a human in the
loop") is only reachable via curl today. The dashboard is the missing human
half of that loop.

## Session model (MVP)

- The dashboard holds a bearer JWT in `sessionStorage` (cleared when the
  browser tab closes; never `localStorage`, never cookies — no CSRF surface).
- Sign-in (MVP): the operator provides a token issued out of band (dev
  tokens in hs256 mode, IdP-issued tokens in jwks mode). The dashboard
  decodes claims client-side for display/UX gating, checks `exp`, and
  validates against the API with a real request before accepting the session.
- **Deferred**: the full OIDC Authorization Code + PKCE flow against the
  external IdP (ADR-016). The session boundary (`auth/session.ts`,
  auth context) is the seam where PKCE lands without touching pages.
- Claims are UX hints only. Every privilege is enforced server-side by the
  policy decision point; the dashboard hides buttons it knows will 403, and
  treats any 401 as session death (redirect to sign-in).

## Application rules

- Pages call the API only through the typed client (`api/`): bearer header,
  Problem Details error parsing, `Idempotency-Key` support, correlation id
  propagation. No raw `fetch` in pages.
- Cursor pagination follows the API contract: opaque `next_cursor`, "load
  more" semantics, never offset math.
- Approval workflow UX mirrors the server rules (requester cannot approve,
  machine actors cannot approve, gated actions execute only after approval)
  so the UI never offers an action the policy will deny — but the server
  remains the only authority.

## Testing strategy

- Vitest unit tests for the session layer, the API client (headers, error
  mapping, 401 handling) and the approval-gating logic — the parts where a
  bug silently breaks security UX.
- Component render tests and end-to-end flows (Playwright against a seeded
  API) are deferred to the phase that wires real deployment environments;
  testing pixel output against a mocked client before that adds maintenance
  without catching the integration bugs that matter.

## Consequences

- `apps/dashboard` joins the npm workspaces; CI verify gains dashboard
  typecheck, unit tests, and production build.
- The dashboard is version-coupled to the API through the OpenAPI artifact:
  a breaking API change shows up as a dashboard PR diff, reviewed together.
- Realtime views (live call monitoring) need the WebSocket contracts that
  ADR-009 explicitly deferred; the dashboard ships read/refresh views until
  that ADR lands.
- Avatar/metaverse surfaces (ADR-004 later phases) are unaffected; this
  stack decision covers the admin/supervisor panel only.
