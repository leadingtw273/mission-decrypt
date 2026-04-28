import { describe, it, expect } from 'vitest';
import { generateSigningKeypair, sign, verify, exportPublicKey, importPublicKey, fingerprint } from './sign';

describe('Ed25519 sign/verify', () => {
  it('round-trip valid signature', async () => {
    const { privateKey, publicKey } = await generateSigningKeypair();
    const msg = new TextEncoder().encode('asset bytes');
    const sig = await sign(privateKey, msg);
    expect(await verify(publicKey, msg, sig)).toBe(true);
  });

  it('verify fails on tampered message', async () => {
    const { privateKey, publicKey } = await generateSigningKeypair();
    const msg = new TextEncoder().encode('original');
    const sig = await sign(privateKey, msg);
    expect(await verify(publicKey, new TextEncoder().encode('tampered'), sig)).toBe(false);
  });

  it('verify fails with wrong public key', async () => {
    const a = await generateSigningKeypair();
    const b = await generateSigningKeypair();
    const msg = new TextEncoder().encode('msg');
    const sig = await sign(a.privateKey, msg);
    expect(await verify(b.publicKey, msg, sig)).toBe(false);
  });

  it('exports and re-imports public key (raw)', async () => {
    const { publicKey } = await generateSigningKeypair();
    const raw = await exportPublicKey(publicKey);
    expect(raw).toHaveLength(32);  // Ed25519 pub key is 32 bytes
    const imported = await importPublicKey(raw);
    expect(imported.algorithm.name).toBe('Ed25519');
  });

  it('fingerprint is deterministic and 16 bytes', async () => {
    const { publicKey } = await generateSigningKeypair();
    const fp1 = await fingerprint(publicKey);
    const fp2 = await fingerprint(publicKey);
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(0);
  });
});
