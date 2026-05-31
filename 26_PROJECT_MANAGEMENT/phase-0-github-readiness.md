---
project: AURION
document: Phase 0 GitHub Readiness
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: active
created_at: 2026-05-31
---

# Phase 0 — GitHub Readiness

This phase prepares AURION to be versioned, reviewed, shared across machines, and presented professionally to companies.

## Outcome

AURION has a clean Git history, a GitHub-ready repository, a clear MVP boundary, and governance rules that keep humans and agents aligned.

## Scope

- Initialize Git locally.
- Prepare repository hygiene files.
- Add contribution, security, changelog, issue, and PR templates.
- Record MVP and repository governance ADRs.
- Correct documentation version/count mismatches.
- Create and connect the GitHub remote.
- Open decision issues for the implementation blockers.

## Out of scope

- Product implementation.
- Backend or frontend scaffolding.
- Provider credentials.
- Production infrastructure.
- Public marketing copy.

## Checklist

- [x] Local Git repository initialized on `main`.
- [x] `.gitignore`, `.gitattributes`, and `.editorconfig` added.
- [x] Contribution and security rules added.
- [x] PR and issue templates added.
- [x] MVP ADR created.
- [x] Git/GitHub governance ADR created.
- [x] Initial local commit created.
- [x] Local GitHub repository creation tool added and tested.
- [x] GitHub remote created and connected.
- [x] Initial commit pushed to GitHub.
- [x] Phase 0 decision issues created in GitHub.
- [ ] Branch protection or repository rules configured after CI exists.

## GitHub repository

- Repository: `https://github.com/danielheroiaagen/AURION`
- Visibility: private
- Default branch: `main`
- Local remote: `origin`

## Decision issues

| Issue | Purpose |
|-------|---------|
| [#1](https://github.com/danielheroiaagen/AURION/issues/1) | Choose backend framework for MVP. |
| [#2](https://github.com/danielheroiaagen/AURION/issues/2) | Define auth, RBAC, and policy model. |
| [#3](https://github.com/danielheroiaagen/AURION/issues/3) | Choose PostgreSQL ORM and migration strategy. |
| [#4](https://github.com/danielheroiaagen/AURION/issues/4) | Define MVP API contracts. |
| [#5](https://github.com/danielheroiaagen/AURION/issues/5) | Define executable database schema for MVP. |
| [#6](https://github.com/danielheroiaagen/AURION/issues/6) | Configure repository protection and CI gates. |

## Next step

Resolve issue #1 first. Backend framework selection affects code structure, package management, testing, OpenAPI, and agent work allocation.
