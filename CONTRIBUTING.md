# Contributing to AURION

AURION is a professional product repository. Every change must be traceable, reviewable, and connected to the documentation.

## Quick path

1. Read `AI_AGENT_START_HERE.md`.
2. Read `DOCUMENTATION_MAP.md`.
3. Pick the document that owns the change.
4. Create or update the relevant ADR, PRD, API, DB, testing, or operations doc.
5. Commit with Conventional Commits.

## Rules

| Area | Rule |
|------|------|
| Commits | Use Conventional Commits only. Never add AI or co-author attribution. |
| Scope | Keep each commit as one reviewable work unit. |
| Docs | User-visible or architectural changes must update docs in the same commit. |
| Security | Never commit secrets, real customer data, tokens, keys, or private credentials. |
| Architecture | Domain rules stay independent from frameworks and providers. |

## Branch names

Use short, descriptive names:

- `docs/phase-0-readiness`
- `feat/voice-session-core`
- `fix/audit-event-validation`
- `adr/backend-framework`

## Review checklist

- [ ] The change has one clear purpose.
- [ ] Relevant documentation is updated.
- [ ] Security, privacy, audit, and tenant isolation were considered.
- [ ] Tests or validation steps are documented.
- [ ] The commit message explains the outcome.

