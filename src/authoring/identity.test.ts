import { beforeEach, describe, expect, it } from 'vitest';

import { generateSigningKeypair } from '../crypto/sign';
import {
  clearIdentity,
  exportIdentityJwk,
  getCommanderPublicKeyFingerprint,
  importIdentityJwk,
  loadIdentity,
  saveIdentity,
} from './identity';

describe('commander identity persistence', () => {
  beforeEach(async () => {
    await clearIdentity();
  });

  it('returns null when no identity exists', async () => {
    await expect(loadIdentity()).resolves.toBeNull();
    await expect(getCommanderPublicKeyFingerprint()).resolves.toBeNull();
  });

  it('saves and loads an Ed25519 keypair', async () => {
    const keypair = await generateSigningKeypair();

    await saveIdentity(keypair);
    const identity = await loadIdentity();

    expect(identity).not.toBeNull();
    expect(identity?.publicKey.type).toBe('public');
    expect(identity?.privateKey.type).toBe('private');
    expect(identity?.publicKey.algorithm.name).toBe('Ed25519');
    expect(identity?.privateKey.algorithm.name).toBe('Ed25519');
    await expect(getCommanderPublicKeyFingerprint()).resolves.toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('clears the stored identity', async () => {
    await saveIdentity(await generateSigningKeypair());

    await clearIdentity();

    await expect(loadIdentity()).resolves.toBeNull();
  });

  it('exports jwk and imports it back with the same fingerprint', async () => {
    await saveIdentity(await generateSigningKeypair());
    const exported = await exportIdentityJwk();
    const before = await getCommanderPublicKeyFingerprint();

    await clearIdentity();
    await importIdentityJwk(exported!);
    const after = await getCommanderPublicKeyFingerprint();

    expect(exported).not.toBeNull();
    expect(exported?.publicKey.kty).toBe('OKP');
    expect(exported?.publicKey.crv).toBe('Ed25519');
    expect(exported?.privateKey.d).toBeTruthy();
    expect(after).toBe(before);
  });
});
