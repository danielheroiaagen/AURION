---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-12
related: ADR-017, ADR-020, ADR-023, ADR-031, ADR-034, ADR-037
---

# ADR-038 — Professional product polish gates

## Decision

AURION now treats professional readiness as an executable product contract,
not a subjective design opinion. Phase 29 adds a root quality gate, updates
the repository entry point, improves responsive dashboard ergonomics, and
turns the public landing's demo CTA into a structured intake path.

The work deliberately stays inside the current architecture:

- Root `lint` is a zero-dependency repository hygiene gate. It checks the
  professional-readiness seams that previously regressed silently: no stub
  scripts, current README framing, responsive dashboard CSS, and structured
  landing demo capture.
- Root `typecheck` aggregates the workspace typechecks. CI still keeps the
  existing explicit workspace checks for review visibility.
- Docker build stages install npm 11 before dependency installation so image
  builds satisfy the same engine contract as local and CI verification.
- The dashboard remains the ADR-017 Vite SPA and ADR-031 visual system. The
  polish is CSS/UX composition, not a framework rewrite.
- The landing remains static and GDPR-honest. Lead intake opens an operator
  email/WhatsApp handoff; no measurement script loads without consent.

## Context

The professional-readiness review found that AURION's backend, security,
voice runtime, CI, and tests are already strong. The weaker signals were
product-facing: root quality scripts were stubs, the README still described
an older documentation package, the dashboard was table-heavy with a fixed
desktop shell, and the landing CTA was only a pair of raw contact links.

## Consequences

- A new contributor or buyer sees the implemented product first, with the
  documentation system as supporting context.
- `npm run lint` and `npm run typecheck` become real root commands; local
  verification matches the CI story.
- The dashboard is credible on narrow screens and has explicit launch
  readiness cues without adding new backend state.
- Public demo capture is more professional, while real CRM/calendar routing
  remains a connector/operator configuration task rather than hidden magic.

## Out of scope

- Real provider credentials and customer-specific connector wiring. Those
  remain n8n/operator setup because secrets do not belong in the repo.
- Billing, pricing enforcement, or CRM persistence. Those need their own ADR
  because they introduce data model and compliance decisions.
