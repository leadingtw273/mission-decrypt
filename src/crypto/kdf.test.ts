import { describe, it, expect } from 'vitest';
import { deriveWrapKey } from './kdf';

describe('deriveWrapKey', () => {
  it('returns CryptoKey usable for AES-GCM', async () => {
    const key = await deriveWrapKey('ABCDEFGHJKMNPQR0', new Uint8Array(16), 1000);
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('same input produces same key (deterministic)', async () => {
    const salt = new Uint8Array(16).fill(7);
    const k1 = await deriveWrapKey('ABCDEFGHJKMNPQR0', salt, 1000);
    const k2 = await deriveWrapKey('ABCDEFGHJKMNPQR0', salt, 1000);
    // Export raw and compare
    const raw1 = await crypto.subtle.exportKey('raw', k1);
    const raw2 = await crypto.subtle.exportKey('raw', k2);
    expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2));
  });

  it('different password produces different key', async () => {
    const salt = new Uint8Array(16).fill(7);
    const k1 = await deriveWrapKey('AAAAEFGHJKMNPQR0', salt, 1000);
    const k2 = await deriveWrapKey('ZZZZEFGHJKMNPQR0', salt, 1000);
    const raw1 = await crypto.subtle.exportKey('raw', k1);
    const raw2 = await crypto.subtle.exportKey('raw', k2);
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
  });

  it('different salt produces different key', async () => {
    const k1 = await deriveWrapKey('ABCDEFGHJKMNPQR0', new Uint8Array(16).fill(1), 1000);
    const k2 = await deriveWrapKey('ABCDEFGHJKMNPQR0', new Uint8Array(16).fill(2), 1000);
    const raw1 = await crypto.subtle.exportKey('raw', k1);
    const raw2 = await crypto.subtle.exportKey('raw', k2);
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
  });
});
