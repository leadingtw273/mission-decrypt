import { describe, it, expect } from 'vitest';
import { aadForWrap, aadForField, aadForHero } from './aad';
import { utf8Decode } from './codec';

const params = {
  kdf: 'PBKDF2-HMAC-SHA256',
  kdfIterations: 600000,
  kdfHash: 'SHA-256',
  derivedKeyLength: 32,
  saltLength: 16,
  cipher: 'AES-256-GCM',
  ivLength: 12,
  gcmTagLength: 16,
  encoding: 'base64url',
  signature: 'Ed25519',
} as const;

describe('AAD builder', () => {
  it('aadForWrap binds version + missionId + lookupKey + params', () => {
    const aad = aadForWrap({
      schemaVersion: '1', cryptoVersion: '1',
      missionId: 'ADE-12345-AB1', lookupKey: 'abcdef', params,
    });
    const text = utf8Decode(aad);
    expect(text).toContain('"missionId":"ADE-12345-AB1"');
    expect(text).toContain('"lookupKey":"abcdef"');
    expect(text).toContain('"schemaVersion":"1"');
  });

  it('aadForField binds version + missionId + fieldName + params', () => {
    const aad = aadForField({
      schemaVersion: '1', cryptoVersion: '1',
      missionId: 'ADE-12345-AB1', fieldName: 'missionTime', params,
    });
    expect(utf8Decode(aad)).toContain('"fieldName":"missionTime"');
  });

  it('aadForHero binds metadata too', () => {
    const aad = aadForHero({
      schemaVersion: '1', cryptoVersion: '1',
      missionId: 'ADE-12345-AB1', params,
      mimeType: 'image/jpeg', byteLength: 1234, altText: 'Test',
    });
    const text = utf8Decode(aad);
    expect(text).toContain('"mimeType":"image/jpeg"');
    expect(text).toContain('"byteLength":1234');
    expect(text).toContain('"altText":"Test"');
    expect(text).toContain('"fieldName":"heroImage"');
  });

  it('AAD is byte-stable across same-input calls', () => {
    const a = aadForField({
      schemaVersion: '1', cryptoVersion: '1',
      missionId: 'X', fieldName: 'f', params,
    });
    const b = aadForField({
      schemaVersion: '1', cryptoVersion: '1',
      missionId: 'X', fieldName: 'f', params,
    });
    expect(a).toEqual(b);
  });

  it('different fieldName produces different AAD', () => {
    const a = aadForField({
      schemaVersion: '1', cryptoVersion: '1',
      missionId: 'X', fieldName: 'a', params,
    });
    const b = aadForField({
      schemaVersion: '1', cryptoVersion: '1',
      missionId: 'X', fieldName: 'b', params,
    });
    expect(a).not.toEqual(b);
  });
});
