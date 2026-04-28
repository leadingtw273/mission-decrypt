import { fromBase64Url } from '../crypto/codec';
import { importPublicKey } from '../crypto/sign';

export const COMMANDER_PUBLIC_KEY_B64URL = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const COMMANDER_PUBLIC_KEY_PLACEHOLDER = COMMANDER_PUBLIC_KEY_B64URL;

let cachedCommanderPublicKey: Promise<CryptoKey> | undefined;

export async function getCommanderPublicKey(): Promise<CryptoKey> {
  cachedCommanderPublicKey ??= importPublicKey(fromBase64Url(COMMANDER_PUBLIC_KEY_B64URL));
  return cachedCommanderPublicKey;
}
