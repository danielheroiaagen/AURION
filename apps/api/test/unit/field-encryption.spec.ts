import { randomBytes } from 'node:crypto';

import {
  FieldEncryptionService,
  parseEncryptionKeys,
} from '../../src/common/crypto/field-encryption.service';

const KEY_A = randomBytes(32);
const KEY_B = randomBytes(32);

function service(keys: { id: string; key: Buffer }[]): FieldEncryptionService {
  return new FieldEncryptionService(keys);
}

describe('parseEncryptionKeys', () => {
  it('parses comma-separated keyId:base64 entries', () => {
    const parsed = parseEncryptionKeys(
      `k1:${KEY_A.toString('base64')}, k2:${KEY_B.toString('base64')}`,
    );
    expect(parsed.map((k) => k.id)).toEqual(['k1', 'k2']);
    expect(parsed[0].key.equals(KEY_A)).toBe(true);
  });

  it('fails closed when unset or empty', () => {
    expect(() => parseEncryptionKeys(undefined)).toThrow(/DATA_ENCRYPTION_KEYS is required/);
    expect(() => parseEncryptionKeys('  ')).toThrow(/DATA_ENCRYPTION_KEYS is required/);
  });

  it('rejects malformed entries: wrong key size, bad key id, duplicates', () => {
    expect(() => parseEncryptionKeys('k1:short')).toThrow(/malformed/);
    expect(() => parseEncryptionKeys(`bad id:${KEY_A.toString('base64')}`)).toThrow(/malformed/);
    expect(() =>
      parseEncryptionKeys(`k1:${KEY_A.toString('base64')},k1:${KEY_B.toString('base64')}`),
    ).toThrow(/duplicate/);
  });
});

describe('FieldEncryptionService', () => {
  it('round-trips plaintext through the versioned envelope', () => {
    const svc = service([{ id: 'k1', key: KEY_A }]);
    const envelope = svc.encrypt('transcript: client asked about pricing');

    expect(envelope).toMatch(/^enc:v1:k1:/);
    expect(svc.isEncrypted(envelope)).toBe(true);
    expect(svc.decrypt(envelope)).toBe('transcript: client asked about pricing');
  });

  it('produces a distinct ciphertext per call (random IV)', () => {
    const svc = service([{ id: 'k1', key: KEY_A }]);
    expect(svc.encrypt('same input')).not.toBe(svc.encrypt('same input'));
  });

  it('detects tampered ciphertext (GCM authentication)', () => {
    const svc = service([{ id: 'k1', key: KEY_A }]);
    const parts = svc.encrypt('sensitive').split(':');
    // Flip the ciphertext segment.
    parts[4] = Buffer.from('forged-payload').toString('base64url');
    expect(() => svc.decrypt(parts.join(':'))).toThrow(/integrity/);
  });

  it('refuses envelopes from unknown keys and rejects wrong-key decryption', () => {
    const writer = service([{ id: 'k1', key: KEY_A }]);
    const envelope = writer.encrypt('cross-key');

    const unknown = service([{ id: 'k2', key: KEY_B }]);
    expect(() => unknown.decrypt(envelope)).toThrow(/No configured key/);

    const wrongMaterial = service([{ id: 'k1', key: KEY_B }]);
    expect(() => wrongMaterial.decrypt(envelope)).toThrow(/integrity/);
  });

  it('supports rotation: new writes use the active key, old envelopes still decrypt', () => {
    const before = service([{ id: 'k1', key: KEY_A }]);
    const legacy = before.encrypt('written before rotation');

    const after = service([
      { id: 'k2', key: KEY_B },
      { id: 'k1', key: KEY_A },
    ]);
    expect(after.encrypt('fresh')).toMatch(/^enc:v1:k2:/);
    expect(after.decrypt(legacy)).toBe('written before rotation');
  });

  it('rejects values that are not envelopes', () => {
    const svc = service([{ id: 'k1', key: KEY_A }]);
    expect(svc.isEncrypted('plain text')).toBe(false);
    expect(() => svc.decrypt('plain text')).toThrow(/not a recognized/);
  });
});
