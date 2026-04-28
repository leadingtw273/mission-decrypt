import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { encryptMission, type MissionAssetV1, type MissionPlaintext } from '../crypto';
import { generateSigningKeypair } from '../crypto/sign';
import { getCommanderPublicKey } from '../publicKeys/commanderPublicKey';
import { useDecryptionMachine } from './useDecryptionMachine';

vi.mock('../publicKeys/commanderPublicKey', () => ({
  getCommanderPublicKey: vi.fn(),
}));

const mockedGetCommanderPublicKey = vi.mocked(getCommanderPublicKey);

const sampleMission: MissionPlaintext = {
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

const sampleHero = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
  mimeType: 'image/jpeg',
  altText: 'Test rally point',
} as const;

let realPublicKey: CryptoKey;
let validAsset: MissionAssetV1;
let forgedAsset: MissionAssetV1;
let validPersonalKey: string;

beforeAll(async () => {
  const real = await generateSigningKeypair();
  const fake = await generateSigningKeypair();

  realPublicKey = real.publicKey;

  const encrypted = await encryptMission({
    mission: sampleMission,
    heroImage: sampleHero,
    members: [{ gameId: 'leadingtw' }],
    commanderPrivateKey: real.privateKey,
  });
  validAsset = encrypted.asset;
  validPersonalKey = encrypted.links[0]!.personalKey;

  forgedAsset = (await encryptMission({
    mission: sampleMission,
    heroImage: sampleHero,
    members: [{ gameId: 'leadingtw' }],
    commanderPrivateKey: fake.privateKey,
  })).asset;
}, 60_000);

afterEach(() => {
  vi.restoreAllMocks();
  mockedGetCommanderPublicKey.mockReset();
});

describe('useDecryptionMachine', () => {
  it('runs the happy path from BOOTSTRAPPING to DECRYPTED', async () => {
    mockedGetCommanderPublicKey.mockResolvedValue(realPublicKey);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse(validAsset));

    const { result } = renderHook(() => useDecryptionMachine(validAsset.missionId));

    await waitFor(() => {
      expect(result.current.state.kind).toBe('LOCKED');
    });

    expect(fetchSpy).toHaveBeenCalledWith(`/missions/${validAsset.missionId}.json?v=1`);

    act(() => {
      result.current.submit('leadingtw', validPersonalKey);
    });

    await waitFor(() => {
      expect(result.current.state.kind).toBe('DECRYPTED');
    });

    expect(result.current.state).toEqual({
      kind: 'DECRYPTED',
      asset: validAsset,
      mission: sampleMission,
      heroImage: {
        mimeType: sampleHero.mimeType,
        bytes: sampleHero.bytes,
        altText: sampleHero.altText,
      },
    });
    expect(mockedGetCommanderPublicKey).toHaveBeenCalledTimes(2);
  });

  it('ends in ERROR(not_found, retryable=true) when asset fetch fails', async () => {
    mockedGetCommanderPublicKey.mockResolvedValue(realPublicKey);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useDecryptionMachine(validAsset.missionId));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        kind: 'ERROR',
        reason: 'not_found',
        retryable: true,
      });
    });
  });

  it('returns to LOCKED after auth_failed then retry', async () => {
    mockedGetCommanderPublicKey.mockResolvedValue(realPublicKey);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse(validAsset));

    const { result } = renderHook(() => useDecryptionMachine(validAsset.missionId));

    await waitFor(() => {
      expect(result.current.state.kind).toBe('LOCKED');
    });

    act(() => {
      result.current.submit('wrongpilot', validPersonalKey);
    });

    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        kind: 'ERROR',
        reason: 'auth_failed',
        retryable: true,
      });
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({
        kind: 'LOCKED',
        missionId: validAsset.missionId,
        asset: validAsset,
      });
    });
  });

  it('does not retry forged_asset errors', async () => {
    mockedGetCommanderPublicKey.mockResolvedValue(realPublicKey);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse(forgedAsset));

    const { result } = renderHook(() => useDecryptionMachine(forgedAsset.missionId));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        kind: 'ERROR',
        reason: 'forged_asset',
        retryable: false,
      });
    });

    act(() => {
      result.current.retry();
    });

    expect(result.current.state).toEqual({
      kind: 'ERROR',
      reason: 'forged_asset',
      retryable: false,
    });
  });
});

function mockJsonResponse(body: unknown, options?: { ok?: boolean; status?: number }): Response {
  const { ok = true, status = 200 } = options ?? {};

  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}
