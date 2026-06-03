---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-01
github_issue: https://github.com/danielheroiaagen/AURION/issues/2
---

# ADR-007 — Auth, RBAC, and policy model for MVP

## Decision

AURION will use **JWT authentication**, **tenant-scoped RBAC**, and an explicit **policy guard** for every protected backend action.

RBAC answers “what role does this actor have?”. The policy guard answers the more important production question: “can this actor do this action, on this tenant resource, right now?”.

## MVP model

| Layer | Decision | Why it matters |
|-------|----------|----------------|
| Identity | Users and machine actors authenticate with signed JWT access tokens. | Every request has a verifiable actor. |
| Tenant boundary | Every customer-owned resource carries `tenant_id`. | Prevents cross-company data leaks. |
| Role boundary | Roles are assigned per tenant, not globally, except internal platform operations. | A user can administer one tenant without leaking authority into another. |
| Policy guard | Application use cases must call one authorization decision point before executing protected actions. | Controllers stay thin and business rules remain testable. |
| Sensitive actions | Risky tool execution requires explicit policy checks and, when needed, human approval. | Voice Agents can act, but not with unrestricted human power. |
| Audit | Authorization decisions for sensitive actions must be auditable. | Companies need evidence, not trust-me security. |

## Roles

- **Platform Owner**: internal AURION operator with platform-level administration.
- **Tenant Admin**: customer admin for one tenant.
- **Supervisor**: reviews conversations, quality, and operational metrics.
- **Human Agent**: handles escalations and customer conversations.
- **Developer/Integrator**: configures integrations and technical settings.
- **Auditor**: reads audit evidence without operational write access.
- **Voice Agent**: machine actor with restricted, tool-specific permissions.

## Policy rules

- Deny by default.
- Require `tenant_id` for tenant-owned resources.
- Never trust role names alone for sensitive actions.
- Keep Voice Agent permissions narrower than human permissions.
- Require human approval for actions that change money, legal state, production configuration, or customer commitments beyond the approved playbook.
- Record audit evidence for denied and approved sensitive decisions.

## Sensitive actions

These actions need explicit policy checks before implementation:

- `tool:execute:calendar.update`
- `tool:execute:ticket.create`
- `tenant:settings:update`
- `knowledge:write`
- `deployment:approve`
- `billing:change`
- `integration:credentials.update`

## Consequences

- Issue #2 can be closed when backend docs reference this ADR and tests protect the policy contract.
- Future NestJS guards must delegate to application/domain policy code instead of embedding rules in controllers.
- Database design must include tenant scoping and audit-friendly actor metadata before feature work expands.
- The MVP can safely support a Voice Agent that executes controlled actions without giving it broad human privileges.

## Out of scope

- Final identity provider selection.
- Full OAuth/OIDC implementation.
- Enterprise SSO and SCIM.
- Fine-grained data retention policies.

Those decisions are important, but they belong in later ADRs once the MVP auth boundary is stable.
