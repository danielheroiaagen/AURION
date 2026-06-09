# Security Policy

AURION handles voice conversations, customer context, tenant configuration, tool execution, and audit trails. Security is not a later phase; it is part of the product foundation.

## Reporting

Do not open public issues with sensitive details. Report security concerns privately to the project owner.

## Non-negotiables

- No secrets in Git.
- No real customer data in examples, tests, screenshots, or docs.
- Every sensitive tool action needs permissions, confirmation, and audit.
- Tenant isolation must be designed before implementation.
- Logs must redact credentials, tokens, personal data, and tool inputs where required.

## Required review for risky changes

- Authentication and authorization.
- Tool execution.
- Tenant isolation.
- Database migrations.
- Voice recording, transcripts, summaries, and memory.
- Third-party integrations and API keys.

## Automated controls in this repository

| Control | Where | Purpose |
|---------|-------|---------|
| Dependency audit | `.github/workflows/security.yml` | `npm audit` gate (high+) on PR, push, and weekly. |
| Secret scanning | `.github/workflows/security.yml` | gitleaks over full history. |
| Static analysis (SAST) | `.github/workflows/codeql.yml` | CodeQL security-and-quality queries. |
| Dependency updates | `.github/dependabot.yml` | Weekly npm and GitHub Actions updates. |
| Pinned actions | `.github/workflows/*.yml` | All actions pinned to commit SHA. |
| Tenant isolation (DB) | `database/migrations/*0002*` | Row-Level Security + append-only audit. |
| Auth boundary | `apps/api/src/modules/auth` | JWT auth + deny-by-default policy guard (ADR-007). |
| Edge hardening | `apps/api/src/main.ts` | Helmet headers, CORS allowlist, rate limiting (ADR-010). |

## Secure-by-default runtime rules

- The API fails closed: it refuses to start without a strong `JWT_SECRET` (min 32 chars).
- Every customer-owned resource is tenant-scoped in code and enforced by Row-Level
  Security in PostgreSQL. The application sets `app.tenant_id` per transaction.
- Audit evidence is append-only (database trigger blocks update/delete).
- All error responses use the Problem Details contract and never leak internals.
- See `.env.example` for the full configuration contract.

