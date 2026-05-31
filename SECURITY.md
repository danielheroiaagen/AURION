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

