import { describe, it, expect } from 'vitest';
import { aesGcmEncrypt, aesGcmDecrypt, generateMasterKey, importMasterKey, exportMasterKey } from './envelope';

describe('envelope (AES-GCM)', () => {
  it('round-trips plaintext with AAD', async () => {
    const M = await generateMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode('aad-string');
    const plaintext = new TextEncoder().encode('hello mission');
    const ct = await aesGcmEncrypt(M, iv, plaintext, aad);
    const pt = await aesGcmDecrypt(M, iv, ct, aad);
    expect(new TextDecoder().decode(pt)).toBe('hello mission');
  });

  it('rejects decryption with wrong AAD', async () => {
    const M = await generateMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode('correct');
    const wrong = new TextEncoder().encode('tampered');
    const ct = await aesGcmEncrypt(M, iv, new TextEncoder().encode('payload'), aad);
    await expect(aesGcmDecrypt(M, iv, ct, wrong)).rejects.toThrow();
  });

  it('rejects decryption with wrong key', async () => {
    const M1 = await generateMasterKey();
    const M2 = await generateMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode('aad');
    const ct = await aesGcmEncrypt(M1, iv, new TextEncoder().encode('payload'), aad);
    await expect(aesGcmDecrypt(M2, iv, ct, aad)).rejects.toThrow();
  });

  it('rejects decryption with corrupted ciphertext', async () => {
    const M = await generateMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode('aad');
    const ct = await aesGcmEncrypt(M, iv, new TextEncoder().encode('payload'), aad);
    ct[0]! ^= 0xff;
    await expect(aesGcmDecrypt(M, iv, ct, aad)).rejects.toThrow();
  });

  it('exportMasterKey + importMasterKey round-trip', async () => {
    const M1 = await generateMasterKey();
    const raw = await exportMasterKey(M1);
    expect(raw).toHaveLength(32);
    const M2 = await importMasterKey(raw);
    const iv = new Uint8Array(12);
    const aad = new TextEncoder().encode('aad');
    const ct = await aesGcmEncrypt(M1, iv, new TextEncoder().encode('x'), aad);
    const pt = await aesGcmDecrypt(M2, iv, ct, aad);
    expect(new TextDecoder().decode(pt)).toBe('x');
  });
});
