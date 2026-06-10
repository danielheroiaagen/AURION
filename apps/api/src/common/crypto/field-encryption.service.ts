import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

/**
 * Application-side column encryption (ADR-011, ADR-012).
 *
 * AES-256-GCM authenticated encryption with versioned keys. Keys live in the
 * secrets manager / environment, never in the repository or the database, so a
 * database-only compromise cannot read protected content.
 *
 * Envelope format (self-describing, rotation-ready):
 *
 *   enc:v1:<keyId>:<iv_b64url>:<ciphertext_b64url>:<tag_b64url>
 *
 * Writes always use the active (first configured) key; reads accept any
 * configured key, so rotation is: add the new key first in the list, keep old
 * keys until re-encryption completes, then drop them.
 */

const ENVELOPE_PREFIX = 'enc';
const ENVELOPE_VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** keyId must stay envelope-safe: no separator characters. */
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface EncryptionKey {
  readonly id: string;
  readonly key: Buffer;
}

export function parseEncryptionKeys(raw: string | undefined): EncryptionKey[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    throw new Error(
      'DATA_ENCRYPTION_KEYS is required: comma-separated "keyId:base64(32 bytes)" entries, ' +
        'active key first (ADR-012). The API will not start without it.',
    );
  }

  const keys = entries.map((entry) => {
    const separator = entry.indexOf(':');
    const id = separator > 0 ? entry.slice(0, separator) : '';
    const material = separator > 0 ? entry.slice(separator + 1) : '';
    const key = Buffer.from(material, 'base64');
    if (!KEY_ID_PATTERN.test(id) || key.length !== KEY_BYTES) {
      throw new Error(
        `DATA_ENCRYPTION_KEYS entry for "${id || entry.slice(0, 8)}" is malformed: ` +
          'expected "keyId:base64(32 bytes)" with keyId matching [A-Za-z0-9_-]+.',
      );
    }
    return { id, key };
  });

  const ids = new Set(keys.map((k) => k.id));
  if (ids.size !== keys.length) {
    throw new Error('DATA_ENCRYPTION_KEYS contains duplicate key ids.');
  }
  return keys;
}

@Injectable()
export class FieldEncryptionService {
  private readonly keys: ReadonlyMap<string, Buffer>;
  private readonly activeKeyId: string;

  constructor(keys?: EncryptionKey[]) {
    const resolved = keys ?? parseEncryptionKeys(process.env.DATA_ENCRYPTION_KEYS);
    this.keys = new Map(resolved.map(({ id, key }) => [id, key]));
    this.activeKeyId = resolved[0].id;
  }

  /** True when the value carries this service's envelope. */
  isEncrypted(value: string): boolean {
    return value.startsWith(`${ENVELOPE_PREFIX}:${ENVELOPE_VERSION}:`);
  }

  encrypt(plaintext: string): string {
    const key = this.keys.get(this.activeKeyId);
    if (!key) {
      throw new Error('Active encryption key is not configured.');
    }
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      ENVELOPE_PREFIX,
      ENVELOPE_VERSION,
      this.activeKeyId,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join(':');
  }

  decrypt(envelope: string): string {
    const parts = envelope.split(':');
    if (parts.length !== 6 || parts[0] !== ENVELOPE_PREFIX || parts[1] !== ENVELOPE_VERSION) {
      throw new Error('Value is not a recognized encryption envelope.');
    }
    const [, , keyId, ivB64, ciphertextB64, tagB64] = parts;
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`No configured key can decrypt envelope with key id "${keyId}".`);
    }

    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('Encryption envelope is malformed.');
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextB64, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // GCM authentication failure: tampered ciphertext, tag, or wrong key.
      throw new Error('Decryption failed: ciphertext integrity check did not pass.');
    }
  }

  /** Constant-time comparison helper for non-reversible markers (e.g. hashes). */
  static safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
