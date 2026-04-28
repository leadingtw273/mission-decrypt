export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function importMasterKey(raw: Uint8Array): Promise<CryptoKey> {
  // External Uint8Array may be a subview into a larger buffer; copy to enforce exact range.
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(raw).buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportMasterKey(key: CryptoKey): Promise<Uint8Array> {
  const buf = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(buf);
}

export async function aesGcmEncrypt(
  key: CryptoKey,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const buf = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      // External Uint8Array may be a subview; copy to enforce exact range.
      iv: new Uint8Array(iv).buffer as ArrayBuffer,
      additionalData: new Uint8Array(aad).buffer as ArrayBuffer,
      tagLength: 128,
    },
    key,
    new Uint8Array(plaintext).buffer as ArrayBuffer,
  );
  return new Uint8Array(buf);
}

export async function aesGcmDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const buf = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv).buffer as ArrayBuffer,
      additionalData: new Uint8Array(aad).buffer as ArrayBuffer,
      tagLength: 128,
    },
    key,
    new Uint8Array(ciphertext).buffer as ArrayBuffer,
  );
  return new Uint8Array(buf);
}
