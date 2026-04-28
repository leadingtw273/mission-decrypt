import { utf8Encode } from './codec';

export const DEFAULT_ITERATIONS = 600_000;
export const DERIVED_KEY_LENGTH_BITS = 256;

export async function deriveWrapKey(
  personalKey: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  // Copy into plain ArrayBuffer to satisfy SubtleCrypto's strict BufferSource type
  const keyMaterial: ArrayBuffer = new Uint8Array(utf8Encode(personalKey)).buffer as ArrayBuffer;
  const saltBuf: ArrayBuffer = new Uint8Array(salt).buffer as ArrayBuffer;

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
