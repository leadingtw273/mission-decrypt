import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { encryptMission, type MissionAssetV1, type MissionPlaintext } from '../crypto';
import { generateSigningKeypair } from '../crypto/sign';
import { loadAsset } from './loadAsset';

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
} as const;

const sampleHero = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
  mimeType: 'image/jpeg',
  altText: 'Test rally point',
} as const;

let realPublicKey: CryptoKey;
let validAsset: MissionAssetV1;
let forgedAsset: MissionAssetV1;

beforeAll(async () => {
  const real = await generateSigningKeypair();
  const fake = await generateSigningKeypair();

  realPublicKey = real.publicKey;
  validAsset = (await encryptMission({
    mission: sampleMission,
    heroImage: sampleHero,
    members: [{ gameId: 'leadingtw' }],
    commanderPrivateKey: real.privateKey,
  })).asset;
  forgedAsset = (await encryptMission({
    mission: sampleMission,
    heroImage: sampleHero,
    members: [{ gameId: 'leadingtw' }],
    commanderPrivateKey: fake.privateKey,
  })).asset;
}, 60_000);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadAsset', () => {
  it('returns ASSET_LOADED for a valid signed asset', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse(validAsset));

    const result = await loadAsset(validAsset.missionId, realPublicKey);

    expect(fetchSpy).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}missions/${validAsset.missionId}.json?v=1`);
    expect(result).toEqual({ ok: true, asset: validAsset });
  });

  it('returns not_found on 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({}, { ok: false, status: 404 }));

    await expect(loadAsset(validAsset.missionId, realPublicKey)).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('returns not_found on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(loadAsset(validAsset.missionId, realPublicKey)).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('returns invalid_asset on malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse(new Error('bad json'), { jsonRejects: true }));

    await expect(loadAsset(validAsset.missionId, realPublicKey)).resolves.toEqual({
      ok: false,
      reason: 'invalid_asset',
    });
  });

  it('returns invalid_asset on schema mismatch', async () => {
    const malformed = {
      ...validAsset,
      fields: {
        ...validAsset.fields,
        missionTime: { iv: 123, ciphertext: 'still-a-string' },
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse(malformed));

    await expect(loadAsset(validAsset.missionId, realPublicKey)).resolves.toEqual({
      ok: false,
      reason: 'invalid_asset',
    });
  });

  it('returns forged_asset on signature verify fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse(forgedAsset));

    await expect(loadAsset(forgedAsset.missionId, realPublicKey)).resolves.toEqual({
      ok: false,
      reason: 'forged_asset',
    });
  });

  it('returns unsupported_version on schemaVersion 99', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      ...validAsset,
      schemaVersion: '99',
    }));

    await expect(loadAsset(validAsset.missionId, realPublicKey)).resolves.toEqual({
      ok: false,
      reason: 'unsupported_version',
    });
  });
});

function mockJsonResponse(
  body: unknown,
  options?: { ok?: boolean; status?: number; jsonRejects?: boolean },
): Response {
  const { ok = true, status = 200, jsonRejects = false } = options ?? {};

  return {
    ok,
    status,
    json: jsonRejects
      ? vi.fn().mockRejectedValue(body)
      : vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}
