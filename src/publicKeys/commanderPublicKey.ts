import { fromBase64Url } from '../crypto/codec';
import { importPublicKey } from '../crypto/sign';

export const COMMANDER_PUBLIC_KEY_B64URL = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const COMMANDER_PUBLIC_KEY_PLACEHOLDER = COMMANDER_PUBLIC_KEY_B64URL;
export const DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL = 'K2OiYxIl8Fj18xXYEQhmdK-b_4Z0WYdCWF_EqwgKr0g';

const cachedCommanderPublicKeys = new Map<string, Promise<CryptoKey>>();

export function getCommanderPublicKeyBase64Url(): string {
  return import.meta.env.DEV
    ? DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL
    : COMMANDER_PUBLIC_KEY_B64URL;
}

export async function getCommanderPublicKey(): Promise<CryptoKey> {
  const base64Url = getCommanderPublicKeyBase64Url();
  let cachedCommanderPublicKey = cachedCommanderPublicKeys.get(base64Url);
  if (!cachedCommanderPublicKey) {
    cachedCommanderPublicKey = importPublicKey(fromBase64Url(base64Url));
    cachedCommanderPublicKeys.set(base64Url, cachedCommanderPublicKey);
  }
  return cachedCommanderPublicKey;
}
