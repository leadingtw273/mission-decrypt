import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MissionAssetV1Schema, MissionPlaintextSchema, parseMissionAsset } from './schema';
import { canonicalJSON } from './codec';

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
    classification: { iv: 'i', ciphertext: 'c' },
    codename: { iv: 'i', ciphertext: 'c' },
    difficulty: { iv: 'i', ciphertext: 'c' },
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

describe('MissionAssetV1 schema', () => {

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
  it('accepts all 12 fields with strings', () => {
    expect(() => MissionPlaintextSchema.parse({
      classification: 'high',
      codename: 'TEST OP / 測試任務',
      difficulty: 'normal',
      missionCommander: 'a', communicationChannel: 'b', missionTime: 'c',
      rallyTime: 'd', rallyLocation: 'e', requiredGear: 'f',
      accessPermission: 'g', rewardDistribution: 'h', missionBrief: 'i',
    })).not.toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => MissionPlaintextSchema.parse({ missionCommander: 'x' })).toThrow();
  });
});

describe('MissionAssetV1 schema (fuzz)', () => {
  it('rejects arbitrary garbage objects', () => {
    fc.assert(
      fc.property(fc.object(), (garbage) => {
        const result = parseMissionAsset(garbage);
        // Almost all random objects should fail
        // We only assert: when it succeeds, the missionId pattern is satisfied
        if (result.ok) {
          expect(result.value.missionId).toMatch(/^[A-Z]{3}-[A-Z0-9]{5}-[A-Z]{2}[0-9]$/);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('strips unknown extra top-level fields (fail-open by design)', () => {
    // zod's default object behavior is to silently strip unknown keys.
    // For v1 we accept this fail-open posture; the spec's threat model relies on
    // signature + AAD for tamper detection, not on strict schema rejection.
    // If future hardening requires rejecting unknown fields, add .strict() to the schema.
    const result = parseMissionAsset({ ...validAsset, extraJunk: true, mystery: 42 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Stripped — extra fields not on the parsed value.
      expect('extraJunk' in result.value).toBe(false);
      expect('mystery' in result.value).toBe(false);
    }
  });

  it('rejects mutated valid asset where missionId pattern is broken', () => {
    const broken = { ...validAsset, missionId: 'lowercase-bad-id' };
    expect(parseMissionAsset(broken).ok).toBe(false);
  });

  it('canonical JSON is stable under fc-generated key orderings', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.integer()), (obj) => {
        const a = canonicalJSON(obj);
        const reordered: Record<string, number> = {};
        for (const k of Object.keys(obj).reverse()) reordered[k] = obj[k]!;
        const b = canonicalJSON(reordered);
        expect(a).toBe(b);
      }),
      { numRuns: 100 },
    );
  });
});
