---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-011, ADR-012, ADR-013
---

# ADR-015 — Encryption key rotation and crypto-shredding

## Decision

AURION rotates field-encryption keys (ADR-011) **without re-encrypting data
synchronously**, relying on the versioned envelope
(`enc:v1:<keyId>:<iv>:<ciphertext>:<tag>`) and the multi-key decryption
already implemented in `FieldEncryptionService`:

1. **Rotation = prepend.** A new key is generated and *prepended* to
   `DATA_ENCRYPTION_KEYS`. The first key encrypts all new writes; every listed
   key can still decrypt. No downtime, no migration window.
2. **Re-encryption is lazy-first, sweep-second.** Rows naturally re-encrypt
   when business writes touch them. A background re-encryption sweep
   (read → decrypt → encrypt with primary → CAS write) retires the old key
   from live data; it is operational tooling, not application startup work
   (same rule as migrations, ADR-008/ADR-012).
3. **Key retirement is evidence-gated.** An old key may be removed from
   `DATA_ENCRYPTION_KEYS` only after a verification query proves no envelope
   in the database still references its `keyId`.
4. **Crypto-shredding is the deletion strategy for encrypted PII.** Destroying
   a key renders every envelope under that `keyId` permanently unreadable.
   The MVP uses *global* keys, so today shredding operates at
   platform-erasure granularity only. Per-tenant data erasure (GDPR Art. 17)
   requires **per-tenant derived keys**, which is explicitly deferred — see
   consequences.

## Context

ADR-011 chose application-layer AES-256-GCM with a rotation-ready envelope and
deferred the operational half: how keys actually rotate, and how encrypted
data dies. Phase 4 made encryption load-bearing (`voice_sessions.summary`,
action payloads), so the procedures must exist *before* production traffic,
not after the first key-compromise scare.

Constraints already in force and unchanged here:

- Keys live only in the API process environment (`DATA_ENCRYPTION_KEYS`);
  they never reach the database server or the repository (ADR-011).
- The first configured key is the **primary** (encrypts); all keys decrypt.
- `keyId` is recorded in every envelope, which is what makes verified
  retirement and shredding possible.

## Rotation procedure (runbook summary)

The operational steps live in `05_SECURITY/key-rotation-runbook.md`; the
contract is:

1. Generate: `openssl rand -base64 32` → new `keyId` (e.g. `k2`).
2. Deploy `DATA_ENCRYPTION_KEYS=k2:<new>,k1:<old>` to all API instances.
   Mixed fleets stay safe during rollout: instances with the old config can
   still decrypt `k2`-encrypted rows only after they reload — so the deploy
   is **config-first, then rolling restart**, never partial.
3. Run the re-encryption sweep until the verification query returns zero
   envelopes referencing `k1`.
4. Remove `k1` from the environment. Record the rotation (date, keyIds,
   verification evidence) in the security log.

**Cadence**: scheduled rotation at least every 12 months; immediate rotation
on suspected exposure (the envelope makes emergency rotation identical to
scheduled rotation — only the urgency of the sweep changes).

## Crypto-shredding

- **Today (global keys)**: destroying all keys is a platform-wide erasure
  mechanism of last resort. It is documented, not automated.
- **Deferred (per-tenant keys)**: tenant offboarding with provable erasure
  requires deriving per-tenant data keys (e.g. HKDF from a master key +
  tenant id, or envelope encryption with a KMS). When AURION signs a customer
  whose compliance demands provable erasure, that ADR must land first. The
  envelope format already carries `keyId`, so per-tenant keys are an additive
  change (`keyId = "t:<tenant>:<version>"`), not a format break.

## Consequences

- `05_SECURITY/key-rotation-runbook.md` is the operational companion to this
  ADR and must be updated together with it.
- The re-encryption sweep tool is intentionally **not** built in this phase:
  building it before the first real rotation would mean shipping untested
  crypto tooling. It is scheduled together with the first scheduled rotation,
  and the runbook documents the interim manual procedure.
- Multi-key decrypt keeps old keys hot in memory; the number of concurrently
  configured keys should stay small (2 during rotation, 1 in steady state).
- Backups: a restored backup may contain envelopes under retired keys.
  Retired keys must therefore be escrowed (offline, access-controlled) for
  the backup retention window, and destroyed afterwards — destroying them
  earlier silently shreds the backups.
