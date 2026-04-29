import {
  getCommanderPublicKeyFingerprint as getStoredCommanderPublicKeyFingerprint,
  loadIdentity,
} from '../authoring/identity';
import { fromBase64Url } from '../crypto/codec';
import { fingerprint, importPublicKey } from '../crypto/sign';

// Production commander public key (leadingtw). Fingerprint
// 20OQIJZ_52EE9YpucdKZ6Q. Missions signed by this identity verify on
// the deployed site even when the visitor's browser has no local
// identity in IndexedDB.
export const COMMANDER_PUBLIC_KEY_B64URL = '0HWDbiYrn_zTEUrdnAe0zgS764jnZfkgy3ZQDToKdko';
export const COMMANDER_PUBLIC_KEY_PLACEHOLDER = COMMANDER_PUBLIC_KEY_B64URL;
// Dev/test fixture key used by scripts/generate-example-mission.ts so
// the bundled _example.json (signed with this key) keeps verifying in
// dev mode. NOT trusted by production builds.
export const DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL = 'K2OiYxIl8Fj18xXYEQhmdK-b_4Z0WYdCWF_EqwgKr0g';

const cachedCommanderPublicKeys = new Map<string, Promise<CryptoKey>>();

type CommanderPublicKeySource =
  | { kind: 'identity'; cacheKey: string; publicKey: CryptoKey }
  | { kind: 'base64url'; cacheKey: string; base64Url: string };

export function getCommanderPublicKeyBase64Url(): string {
  return import.meta.env.DEV
    ? DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL
    : COMMANDER_PUBLIC_KEY_B64URL;
}

export async function getCommanderPublicKey(): Promise<CryptoKey> {
  const source = await resolveCommanderPublicKeySource();
  let cachedCommanderPublicKey = cachedCommanderPublicKeys.get(source.cacheKey);
  if (!cachedCommanderPublicKey) {
    cachedCommanderPublicKey = source.kind === 'identity'
      ? Promise.resolve(source.publicKey)
      : importPublicKey(fromBase64Url(source.base64Url));
    cachedCommanderPublicKeys.set(source.cacheKey, cachedCommanderPublicKey);
  }
  return cachedCommanderPublicKey;
}

export async function getCommanderPublicKeyFingerprint(): Promise<string> {
  const identityFingerprint = await getStoredCommanderPublicKeyFingerprint();
  if (identityFingerprint) {
    return identityFingerprint;
  }

  return fingerprint(await getCommanderPublicKey());
}

async function resolveCommanderPublicKeySource(): Promise<CommanderPublicKeySource> {
  const identity = await loadIdentity();
  if (identity) {
    return {
      kind: 'identity',
      cacheKey: `identity:${await fingerprint(identity.publicKey)}`,
      publicKey: identity.publicKey,
    };
  }

  const base64Url = getCommanderPublicKeyBase64Url();
  return {
    kind: 'base64url',
    cacheKey: `base64url:${base64Url}`,
    base64Url,
  };
}
