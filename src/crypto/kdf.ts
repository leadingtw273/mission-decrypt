import { utf8Encode } from './codec';

export const DEFAULT_ITERATIONS = 600_000;
export const DERIVED_KEY_LENGTH_BITS = 256;

export async function deriveWrapKey(
  personalKey: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  // TextEncoder.encode() always returns a fresh, exactly-sized buffer — direct .buffer is safe.
  const keyMaterial = utf8Encode(personalKey).buffer as ArrayBuffer;
  // External Uint8Array may be a subview into a larger buffer; copy to enforce exact range.
  const saltBuf = new Uint8Array(salt).buffer as ArrayBuffer;

  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBuf,
      iterations,
    },
    baseKey,
    { name: 'AES-GCM', length: DERIVED_KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt'],
  );
}
