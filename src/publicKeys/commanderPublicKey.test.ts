import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSigningKeypair, fingerprint } from '../crypto/sign';

const { mockLoadIdentity, mockGetIdentityFingerprint } = vi.hoisted(() => ({
  mockLoadIdentity: vi.fn(),
  mockGetIdentityFingerprint: vi.fn(),
}));

vi.mock('../authoring/identity', () => ({
  loadIdentity: mockLoadIdentity,
  getCommanderPublicKeyFingerprint: mockGetIdentityFingerprint,
}));

import {
  COMMANDER_PUBLIC_KEY_B64URL,
  DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL,
  COMMANDER_PUBLIC_KEY_PLACEHOLDER,
  getCommanderPublicKeyBase64Url,
  getCommanderPublicKey,
  getCommanderPublicKeyFingerprint,
} from './commanderPublicKey';

describe('commander public key placeholder', () => {
  beforeEach(() => {
    mockLoadIdentity.mockReset();
    mockLoadIdentity.mockResolvedValue(null);
    mockGetIdentityFingerprint.mockReset();
    mockGetIdentityFingerprint.mockResolvedValue(null);
  });

  it('exports valid base64url placeholder constants', () => {
    expect(COMMANDER_PUBLIC_KEY_PLACEHOLDER).toBe(COMMANDER_PUBLIC_KEY_B64URL);
    expect(COMMANDER_PUBLIC_KEY_B64URL).toHaveLength(43);
    expect(DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL).toHaveLength(43);
    // Production commander key is a real (leadingtw) identity, distinct
    // from the dev test fixture key that signs _example.json.
    expect(COMMANDER_PUBLIC_KEY_B64URL).not.toBe(DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL);
  });

  it('uses the fixed dev test key in dev mode', () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(DEV_TEST_COMMANDER_PUBLIC_KEY_B64URL).toHaveLength(43);
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

  it('prefers the identity public key when one exists', async () => {
    const identity = await generateSigningKeypair();
    mockLoadIdentity.mockResolvedValueOnce(identity);
    mockLoadIdentity.mockResolvedValueOnce(identity);

    const key1 = await getCommanderPublicKey();
    const key2 = await getCommanderPublicKey();

    expect(key1).toBe(identity.publicKey);
    expect(key2).toBe(identity.publicKey);
  });

  it('returns the identity fingerprint when one exists, else falls back to the current key', async () => {
    mockGetIdentityFingerprint.mockResolvedValueOnce('identity-fingerprint');

    await expect(getCommanderPublicKeyFingerprint()).resolves.toBe('identity-fingerprint');

    mockGetIdentityFingerprint.mockResolvedValueOnce(null);

    const expectedFallbackFingerprint = await fingerprint(await getCommanderPublicKey());

    await expect(getCommanderPublicKeyFingerprint()).resolves.toBe(expectedFallbackFingerprint);
  });

  it('invalidates the cached key when the identity changes', async () => {
    const firstIdentity = await generateSigningKeypair();
    const secondIdentity = await generateSigningKeypair();
    mockLoadIdentity
      .mockResolvedValueOnce(firstIdentity)
      .mockResolvedValueOnce(secondIdentity);

    const key1 = await getCommanderPublicKey();
    const key2 = await getCommanderPublicKey();

    expect(key1).toBe(firstIdentity.publicKey);
    expect(key2).toBe(secondIdentity.publicKey);
    expect(await fingerprint(key1)).not.toBe(await fingerprint(key2));
  });
});
