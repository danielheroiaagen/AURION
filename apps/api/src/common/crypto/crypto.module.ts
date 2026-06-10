import { Global, Module } from '@nestjs/common';

import { FieldEncryptionService, parseEncryptionKeys } from './field-encryption.service';

/**
 * Global crypto module (ADR-011, ADR-012). Instantiated eagerly at startup so
 * a missing or malformed `DATA_ENCRYPTION_KEYS` aborts boot (fail closed) —
 * the API never runs in a state where it could persist sensitive content in
 * plaintext for lack of keys.
 */
@Global()
@Module({
  providers: [
    {
      provide: FieldEncryptionService,
      useFactory: (): FieldEncryptionService =>
        new FieldEncryptionService(parseEncryptionKeys(process.env.DATA_ENCRYPTION_KEYS)),
    },
  ],
  exports: [FieldEncryptionService],
})
export class CryptoModule {}
