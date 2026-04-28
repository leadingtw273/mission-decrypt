import { describe, it, expect } from 'vitest';
import { MissionAssetV1Schema, MissionPlaintextSchema, parseMissionAsset } from './schema';

describe('MissionAssetV1 schema', () => {
  const validAsset = {
    schemaVersion: '1',
    cryptoVersion: '1',
    lookupVersion: '1',
    normalizationVersion: '1',
    missionId: 'ADE-12345-AB1',
    createdAt: '2026-04-28T10:00:00Z',
    params: {
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
    },
    wrappedKeys: {
      'abc123': { salt: 'AAAA', iv: 'BBBB', wrapped: 'CCCC' },
    },
    fields: {
      missionCommander: { iv: 'i', ciphertext: 'c' },
      communicationChannel: { iv: 'i', ciphertext: 'c' },
      missionTime: { iv: 'i', ciphertext: 'c' },
      rallyTime: { iv: 'i', ciphertext: 'c' },
      rallyLocation: { iv: 'i', ciphertext: 'c' },
      requiredGear: { iv: 'i', ciphertext: 'c' },
      accessPermission: { iv: 'i', ciphertext: 'c' },
      rewardDistribution: { iv: 'i', ciphertext: 'c' },
      missionBrief: { iv: 'i', ciphertext: 'c' },
    },
    heroImage: {
      iv: 'i', ciphertext: 'c',
      metadata: { mimeType: 'image/jpeg', byteLength: 100, altText: 'alt' },
    },
    signature: {
      alg: 'Ed25519',
      publicKeyFingerprint: 'fp',
      value: 'sig',
    },
  };

  it('parses valid asset', () => {
    expect(() => MissionAssetV1Schema.parse(validAsset)).not.toThrow();
  });

  it('rejects missing fields', () => {
    const broken = { ...validAsset, fields: { ...validAsset.fields, missionTime: undefined } };
    expect(() => MissionAssetV1Schema.parse(broken)).toThrow();
  });

  it('rejects unknown schemaVersion', () => {
    expect(() => MissionAssetV1Schema.parse({ ...validAsset, schemaVersion: '99' })).toThrow();
  });

  it('rejects mission_id not matching pattern', () => {
    expect(() => MissionAssetV1Schema.parse({ ...validAsset, missionId: 'invalid' })).toThrow();
  });

  it('parseMissionAsset returns Result', () => {
    const ok = parseMissionAsset(validAsset);
    expect(ok.ok).toBe(true);
    const err = parseMissionAsset({ broken: true });
    expect(err.ok).toBe(false);
  });
});

describe('MissionPlaintextSchema', () => {
  it('accepts all 9 fields with strings', () => {
    expect(() => MissionPlaintextSchema.parse({
      missionCommander: 'a', communicationChannel: 'b', missionTime: 'c',
      rallyTime: 'd', rallyLocation: 'e', requiredGear: 'f',
      accessPermission: 'g', rewardDistribution: 'h', missionBrief: 'i',
    })).not.toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => MissionPlaintextSchema.parse({ missionCommander: 'x' })).toThrow();
  });
});
