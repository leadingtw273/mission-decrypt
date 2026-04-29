import { describe, expect, it, vi, afterEach } from 'vitest';

import { type MissionAssetV1, type MissionPlaintext } from '../crypto';
import { initialState, reducer, type State } from './state';

const sampleAsset: MissionAssetV1 = {
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
    abc123: { salt: 'AAAA', iv: 'BBBB', wrapped: 'CCCC' },
  },
  fields: {
    classification: { iv: 'i', ciphertext: 'c', charCount: 12 },
    codename: { iv: 'i', ciphertext: 'c', charCount: 12 },
    difficulty: { iv: 'i', ciphertext: 'c', charCount: 12 },
    missionCommander: { iv: 'i', ciphertext: 'c', charCount: 12 },
    communicationChannel: { iv: 'i', ciphertext: 'c', charCount: 12 },
    missionTime: { iv: 'i', ciphertext: 'c', charCount: 12 },
    rallyTime: { iv: 'i', ciphertext: 'c', charCount: 12 },
    rallyLocation: { iv: 'i', ciphertext: 'c', charCount: 12 },
    requiredGear: { iv: 'i', ciphertext: 'c', charCount: 12 },
    accessPermission: { iv: 'i', ciphertext: 'c', charCount: 12 },
    rewardDistribution: { iv: 'i', ciphertext: 'c', charCount: 12 },
    missionBrief: { iv: 'i', ciphertext: 'c', charCount: 12 },
  },
  heroImage: {
    iv: 'i',
    ciphertext: 'c',
    metadata: {
      mimeType: 'image/jpeg',
      byteLength: 100,
      altText: 'alt',
    },
  },
  signature: {
    alg: 'Ed25519',
    publicKeyFingerprint: 'fp',
    value: 'sig',
  },
};

const sampleMission: MissionPlaintext = {
  classification: 'high',
  codename: 'TEST OP / 測試任務',
  difficulty: 'normal',
  missionCommander: 'Lt. Zhou [leadingtw]',
  communicationChannel: 'Strategy Channel > Deep Space',
  missionTime: '22:00 - 24:00 (GMT+8)',
  rallyTime: '21:30 (GMT+8)',
  rallyLocation: 'Orison',
  requiredGear: 'Any, Ammo Full',
  accessPermission: 'All Pilots',
  rewardDistribution: 'None',
  missionBrief: 'Rally at 21:30, depart at 22:00.',
};

const sampleHeroImage = {
  mimeType: 'image/jpeg',
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
  altText: 'Test rally point',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('decryption state reducer', () => {
  it('BOOTSTRAPPING + ENV_OK -> ASSET_LOADING', () => {
    expect(reducer(initialState, { type: 'ENV_OK', missionId: sampleAsset.missionId })).toEqual({
      kind: 'ASSET_LOADING',
      missionId: sampleAsset.missionId,
    });
  });

  it('BOOTSTRAPPING + ENV_FAIL(missing_mission_id) -> ERROR(missing_mission_id, retryable=false)', () => {
    expect(reducer(initialState, { type: 'ENV_FAIL', reason: 'missing_mission_id' })).toEqual({
      kind: 'ERROR',
      reason: 'missing_mission_id',
      retryable: false,
    });
  });

  it('BOOTSTRAPPING + ENV_FAIL(unsupported_env) -> ERROR(unsupported_env, retryable=false)', () => {
    expect(reducer(initialState, { type: 'ENV_FAIL', reason: 'unsupported_env' })).toEqual({
      kind: 'ERROR',
      reason: 'unsupported_env',
      retryable: false,
    });
  });

  it('ASSET_LOADING + ASSET_LOADED -> LOCKED', () => {
    const state: State = { kind: 'ASSET_LOADING', missionId: sampleAsset.missionId };

    expect(reducer(state, { type: 'ASSET_LOADED', asset: sampleAsset })).toEqual({
      kind: 'LOCKED',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
    });
  });

  it("ASSET_LOADING + ASSET_FAILED('not_found') -> ERROR(not_found, retryable=true)", () => {
    const state: State = { kind: 'ASSET_LOADING', missionId: sampleAsset.missionId };

    expect(reducer(state, { type: 'ASSET_FAILED', reason: 'not_found' })).toEqual({
      kind: 'ERROR',
      reason: 'not_found',
      retryable: true,
    });
  });

  it("ASSET_LOADING + ASSET_FAILED('invalid_asset') -> ERROR(invalid_asset, retryable=false)", () => {
    const state: State = { kind: 'ASSET_LOADING', missionId: sampleAsset.missionId };

    expect(reducer(state, { type: 'ASSET_FAILED', reason: 'invalid_asset' })).toEqual({
      kind: 'ERROR',
      reason: 'invalid_asset',
      retryable: false,
    });
  });

  it("ASSET_LOADING + ASSET_FAILED('forged_asset') -> ERROR(forged_asset, retryable=false)", () => {
    const state: State = { kind: 'ASSET_LOADING', missionId: sampleAsset.missionId };

    expect(reducer(state, { type: 'ASSET_FAILED', reason: 'forged_asset' })).toEqual({
      kind: 'ERROR',
      reason: 'forged_asset',
      retryable: false,
    });
  });

  it("ASSET_LOADING + ASSET_FAILED('unsupported_version') -> ERROR(unsupported_version, retryable=false)", () => {
    const state: State = { kind: 'ASSET_LOADING', missionId: sampleAsset.missionId };

    expect(reducer(state, { type: 'ASSET_FAILED', reason: 'unsupported_version' })).toEqual({
      kind: 'ERROR',
      reason: 'unsupported_version',
      retryable: false,
    });
  });

  it('LOCKED + SUBMIT -> DECRYPTING and preserves missionId, asset, credentials', () => {
    const state: State = {
      kind: 'LOCKED',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
    };

    expect(reducer(state, { type: 'SUBMIT', gameId: 'leadingtw', personalKey: 'ABCD-EFGH-JKMN-PQR0' })).toEqual({
      kind: 'DECRYPTING',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
      gameId: 'leadingtw',
      personalKey: 'ABCD-EFGH-JKMN-PQR0',
    });
  });

  it('DECRYPTING + DECRYPT_OK -> DECRYPTED', () => {
    const state: State = {
      kind: 'DECRYPTING',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
      gameId: 'leadingtw',
      personalKey: 'ABCD-EFGH-JKMN-PQR0',
    };

    expect(reducer(state, { type: 'DECRYPT_OK', asset: sampleAsset, mission: sampleMission, heroImage: sampleHeroImage })).toEqual({
      kind: 'DECRYPTED',
      asset: sampleAsset,
      mission: sampleMission,
      heroImage: sampleHeroImage,
    });
  });

  it("DECRYPTING + DECRYPT_FAIL('auth_failed') -> ERROR(auth_failed, retryable=true, lastAsset)", () => {
    const state: State = {
      kind: 'DECRYPTING',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
      gameId: 'leadingtw',
      personalKey: 'ABCD-EFGH-JKMN-PQR0',
    };

    expect(reducer(state, { type: 'DECRYPT_FAIL', reason: 'auth_failed' })).toEqual({
      kind: 'ERROR',
      reason: 'auth_failed',
      retryable: true,
      lastAsset: sampleAsset,
    });
  });

  it('ERROR(retryable=true, lastAsset) + RETRY -> LOCKED', () => {
    const state: State = {
      kind: 'ERROR',
      reason: 'auth_failed',
      retryable: true,
      lastAsset: sampleAsset,
    };

    expect(reducer(state, { type: 'RETRY' })).toEqual({
      kind: 'LOCKED',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
    });
  });

  it('ERROR(retryable=true) + RETRY -> BOOTSTRAPPING when no lastAsset is available', () => {
    const state: State = {
      kind: 'ERROR',
      reason: 'not_found',
      retryable: true,
    };

    expect(reducer(state, { type: 'RETRY' })).toEqual(initialState);
  });

  it('DECRYPTING + DECRYPT_FAIL(cipher_corrupt) -> ERROR(cipher_corrupt, retryable=false)', () => {
    const state: State = {
      kind: 'DECRYPTING',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
      gameId: 'leadingtw',
      personalKey: 'ABCD-EFGH-JKMN-PQR0',
    };

    expect(reducer(state, { type: 'DECRYPT_FAIL', reason: 'cipher_corrupt' })).toEqual({
      kind: 'ERROR',
      reason: 'cipher_corrupt',
      retryable: false,
    });
  });

  it('DECRYPTING + DECRYPT_FAIL(invalid_personal_key_format) -> ERROR(invalid_personal_key_format, retryable=true)', () => {
    const state: State = {
      kind: 'DECRYPTING',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
      gameId: 'leadingtw',
      personalKey: 'bad',
    };

    expect(reducer(state, { type: 'DECRYPT_FAIL', reason: 'invalid_personal_key_format' })).toEqual({
      kind: 'ERROR',
      reason: 'invalid_personal_key_format',
      retryable: true,
      lastAsset: sampleAsset,
    });
  });

  it('warns and returns current state for invalid transitions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state: State = {
      kind: 'DECRYPTED',
      asset: sampleAsset,
      mission: sampleMission,
      heroImage: sampleHeroImage,
    };

    expect(reducer(state, { type: 'SUBMIT', gameId: 'leadingtw', personalKey: 'ABCD-EFGH-JKMN-PQR0' })).toBe(state);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
