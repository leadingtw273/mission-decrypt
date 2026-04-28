import { toBase64Url } from './codec';

export interface SigningKeypair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export async function generateSigningKeypair(): Promise<SigningKeypair> {
  const kp = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair;
  return { privateKey: kp.privateKey, publicKey: kp.publicKey };
}

export async function sign(privateKey: CryptoKey, message: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    new Uint8Array(message).buffer as ArrayBuffer,
  );
  return new Uint8Array(buf);
}

export async function verify(publicKey: CryptoKey, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
  return crypto.subtle.verify(
    { name: 'Ed25519' },
    publicKey,
    new Uint8Array(signature).buffer as ArrayBuffer,
    new Uint8Array(message).buffer as ArrayBuffer,
  );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<Uint8Array> {
  const buf = await crypto.subtle.exportKey('raw', publicKey);
  return new Uint8Array(buf);
}

export async function importPublicKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(raw).buffer as ArrayBuffer,
    { name: 'Ed25519' },
    true,
    ['verify'],
  );
}

export async function fingerprint(publicKey: CryptoKey): Promise<string> {
  const raw = await exportPublicKey(publicKey);
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(raw).buffer as ArrayBuffer);
  return toBase64Url(new Uint8Array(hash).slice(0, 16));
}
