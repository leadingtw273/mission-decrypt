import { describe, expect, it } from 'vitest';
import {
  COMMANDER_PUBLIC_KEY_B64URL,
  DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL,
  COMMANDER_PUBLIC_KEY_PLACEHOLDER,
  getCommanderPublicKeyBase64Url,
  getCommanderPublicKey,
} from './commanderPublicKey';

describe('commander public key placeholder', () => {
  it('exports the expected placeholder constants', () => {
    expect(COMMANDER_PUBLIC_KEY_B64URL).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(COMMANDER_PUBLIC_KEY_PLACEHOLDER).toBe(COMMANDER_PUBLIC_KEY_B64URL);
    expect(COMMANDER_PUBLIC_KEY_B64URL).toHaveLength(43);
  });

  it('uses the fixed dev test key in dev mode', () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL).toHaveLength(43);
    expect(DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL).not.toBe(COMMANDER_PUBLIC_KEY_PLACEHOLDER);
    expect(getCommanderPublicKeyBase64Url()).toBe(DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL);
  });

  it('imports the placeholder key and caches it', async () => {
    const key1 = await getCommanderPublicKey();
    const key2 = await getCommanderPublicKey();

    expect(key1).toBe(key2);
    expect(key1.type).toBe('public');
    expect(key1.extractable).toBe(true);
    expect(key1.usages).toEqual(['verify']);
    expect(key1.algorithm.name).toBe('Ed25519');
  });
});
