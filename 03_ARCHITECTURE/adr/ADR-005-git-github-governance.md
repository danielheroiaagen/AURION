---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-05-31
---

# ADR-005 — Git and GitHub Governance

## Decision

AURION will use Git and GitHub from Phase 0 with a professional repository structure, Conventional Commits, reviewable work units, and documentation-first governance.

## Context

The repository is both a product foundation and a credibility asset for showing companies what can be built. It must be clean enough for collaboration, review, and cross-device access.

## Rules

- Default branch: `main`.
- Commit style: Conventional Commits.
- No `Co-Authored-By` or AI attribution in commits.
- No secrets, tokens, real customer data, or private credentials.
- Pull requests must describe scope, verification, risks, and relevant documentation.
- Architecture decisions must be recorded as ADRs.

## Consequences

- Every phase can be reviewed and rolled back.
- The repository remains presentable to clients and collaborators.
- Future agents must work through small, traceable changes instead of broad unreviewable edits.

