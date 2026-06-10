---
project: AURION
document: Key Rotation Runbook
folder: 05_SECURITY
owner: Daniel Gonzalez Junco
status: active
created_at: 2026-06-10
related: ADR-011, ADR-015
---

# Key rotation runbook

Operational procedure for rotating `DATA_ENCRYPTION_KEYS` (ADR-015). The
envelope format `enc:v1:<keyId>:...` makes rotation a configuration change
plus a verified sweep — no downtime, no schema migration.

## When to rotate

| Trigger | Urgency |
|---------|---------|
| Scheduled (≥ every 12 months) | Planned maintenance |
| Key suspected exposed (leaked env, compromised host, offboarded operator with prod access) | Immediately |
| Compliance/customer requirement | Per contract |

## Procedure

### 1. Generate the new key

```
openssl rand -base64 32
```

Pick the next key id (`k1` → `k2`). Never reuse a key id.

### 2. Deploy config-first, then rolling restart

Set on **every** API instance:

```
DATA_ENCRYPTION_KEYS=k2:<new-base64>,k1:<old-base64>
```

Order matters: the **first** key encrypts new writes; all keys decrypt.
Do not restart any instance until all instances have the new config staged,
then restart the fleet. An instance still running the old config cannot
decrypt rows already written under `k2`.

### 3. Re-encrypt existing data

Until the automated sweep tool exists (deferred per ADR-015), re-encryption is
manual and lazy-first: rows re-encrypt under `k2` whenever business writes
touch them. To force the long tail, an operator with database access lists
rows still under the old key and triggers no-op updates through the API (never
raw SQL writes to encrypted columns).

Verification query — must return **0** for every encrypted column before
retiring `k1`:

```sql
SELECT count(*) FROM voice_sessions   WHERE summary LIKE 'enc:v1:k1:%';
SELECT count(*) FROM controlled_actions
  WHERE request_payload->>'ciphertext' LIKE 'enc:v1:k1:%'
     OR result_payload->>'ciphertext'  LIKE 'enc:v1:k1:%';
```

(Extend this list whenever a new column adopts ADR-011 encryption.)

### 4. Retire the old key

1. Remove `k1:` from `DATA_ENCRYPTION_KEYS`, rolling restart.
2. **Escrow** `k1` offline (sealed, access-controlled) for the full backup
   retention window — a restored backup may still hold `k1` envelopes.
3. After the retention window: destroy the escrowed key and record the
   destruction. This is the crypto-shred of the backup tail.
4. Record the rotation in the security log: date, key ids, verification
   query output, operator.

## Emergency rotation (suspected compromise)

Same procedure, compressed: generate, deploy, restart fleet immediately.
Treat all data under the exposed key as readable by the attacker until the
sweep completes; assess notification duties accordingly. The exposed key is
NOT escrowed — it is destroyed as soon as verification returns zero, and the
backup implications are accepted and recorded as part of the incident.

## Crypto-shredding (current capability)

Keys are global in the MVP: destroying every key erases **all** encrypted
fields platform-wide. Per-tenant erasure requires per-tenant keys (deferred,
ADR-015). Do not promise per-tenant crypto-shredding to customers until that
ADR lands.

## Invariants (do not break)

- Keys never reach the database server, the repository, or logs (ADR-011).
- Production `keyId`s and key material are never reused across environments.
- A `dispatch_mode: "noop"` or a decryption failure spike after rotation is
  an incident signal — check fleet config consistency first.
