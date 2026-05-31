---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-05-31
---

# ADR-004 — Voice Agent SaaS Core as MVP

## Decision

AURION will start with a focused **Voice Agent SaaS Core** MVP before building the full avatar, metaverse, Hermes automation, enterprise compliance, and advanced sector playbooks.

## Context

The full product vision is intentionally ambitious. Building everything at once would create architectural drift, unclear validation, and avoidable delivery risk.

## MVP scope

- Multi-tenant foundation.
- Admin login and company configuration.
- Simple knowledge base.
- Realtime voice agent.
- One controlled action, such as appointment booking or ticket creation.
- Call transcript, summary, audit trail, and basic metrics.
- Critical tests for permissions, voice flow, and action execution.

## Consequences

- The first release validates the hardest product promise: a real conversation can safely answer, act, and leave evidence.
- Avatar, holographic presence, deep Hermes automation, marketplace, and broad integrations move to later phases.
- Documentation and agents must treat this ADR as the first delivery boundary.

