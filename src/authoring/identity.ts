import { fingerprint } from '../crypto/sign';

const DB_NAME = 'vesper-mission';
const STORE_NAME = 'commander-identity';
const RECORD_KEY = 'self';

interface StoredIdentityRecord {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  createdAt: string;
  fingerprint: string;
}

export interface CommanderIdentity {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function loadIdentity(): Promise<CommanderIdentity | null> {
  const record = await readStoredIdentity();
  if (!record) {
    return null;
  }

  const [publicKey, privateKey] = await Promise.all([
    importPublicKeyJwk(record.publicKeyJwk),
    importPrivateKeyJwk(record.privateKeyJwk),
  ]);

  return { publicKey, privateKey };
}

export async function saveIdentity(keypair: CryptoKeyPair): Promise<void> {
  const exported = await exportKeypairJwk(keypair);
  const value = await toStoredRecord(exported);
  await writeStoredIdentity(value);
}

export async function clearIdentity(): Promise<void> {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).delete(RECORD_KEY);

    request.onerror = () => reject(request.error ?? new Error('failed to clear identity'));
    transaction.onerror = () => reject(transaction.error ?? new Error('failed to clear identity'));
    transaction.oncomplete = () => resolve();
  });
}

export async function exportIdentityJwk(): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | null> {
  const record = await readStoredIdentity();
  if (!record) {
    return null;
  }

  return {
    publicKey: record.publicKeyJwk,
    privateKey: record.privateKeyJwk,
  };
}

export async function importIdentityJwk(input: { publicKey: JsonWebKey; privateKey: JsonWebKey }): Promise<void> {
  const value = await toStoredRecord(input);
  await writeStoredIdentity(value);
}

export async function getCommanderPublicKeyFingerprint(): Promise<string | null> {
  const identity = await loadIdentity();
  if (!identity) {
    return null;
  }
  return fingerprint(identity.publicKey);
}

async function exportKeypairJwk(keypair: CryptoKeyPair): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey }> {
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey('jwk', keypair.publicKey),
    crypto.subtle.exportKey('jwk', keypair.privateKey),
  ]);

  return { publicKey, privateKey };
}

async function toStoredRecord(input: { publicKey: JsonWebKey; privateKey: JsonWebKey }): Promise<StoredIdentityRecord> {
  const publicKey = await importPublicKeyJwk(input.publicKey);

  return {
    publicKeyJwk: input.publicKey,
    privateKeyJwk: input.privateKey,
    createdAt: new Date().toISOString(),
    fingerprint: await fingerprint(publicKey),
  };
}

async function importPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, true, ['verify']);
}

async function importPrivateKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, true, ['sign']);
}

async function readStoredIdentity(): Promise<StoredIdentityRecord | null> {
  const db = await openDatabase();

  return new Promise<StoredIdentityRecord | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);

    request.onerror = () => reject(request.error ?? new Error('failed to load identity'));
    transaction.onerror = () => reject(transaction.error ?? new Error('failed to load identity'));
    request.onsuccess = () => {
      resolve((request.result as StoredIdentityRecord | undefined) ?? null);
    };
  });
}

async function writeStoredIdentity(record: StoredIdentityRecord): Promise<void> {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).put(record, RECORD_KEY);

    request.onerror = () => reject(request.error ?? new Error('failed to save identity'));
    transaction.onerror = () => reject(transaction.error ?? new Error('failed to save identity'));
    transaction.oncomplete = () => resolve();
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error ?? new Error('failed to open identity database'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}
