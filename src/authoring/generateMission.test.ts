import { describe, expect, it } from 'vitest';

import { decryptMission, type MissionPlaintext } from '../crypto';
import { generateSigningKeypair } from '../crypto/sign';
import { generateMission } from './generateMission';

const sampleMission: MissionPlaintext = {
  missionCommander: 'Lt. Zhou [leadingtw]',
  communicationChannel: 'Strategy Channel > Deep Space',
  missionTime: '22:00 - 24:00 (GMT+8)',
  rallyTime: '21:30 (GMT+8)',
  rallyLocation: 'Orison',
  requiredGear: 'Any, Ammo Full',
  accessPermission: 'All Pilots',
  rewardDistribution: 'None',
  missionBrief: 'Rally at 21:30, depart at 22:00. Late arrivals can join in deep space.',
};

describe('generateMission', () => {
  it('encrypts a mission and overrides member link urls with baseUrl', async () => {
    const identity = await generateSigningKeypair();
    const result = await generateMission({
      mission: sampleMission,
      heroImage: {
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
        mimeType: 'image/jpeg',
        altText: 'Test rally point',
      },
      members: [{ gameId: 'leadingtw' }, { gameId: 'ace_pilot_42' }],
      identity: { privateKey: identity.privateKey },
      baseUrl: 'https://ops.example/base/',
    });

    expect(result.missionId).toBe(result.asset.missionId);
    expect(result.links).toHaveLength(2);
    expect(result.asset.signature.alg).toBe('Ed25519');
    expect(result.asset.heroImage.metadata).toEqual({
      mimeType: 'image/jpeg',
      byteLength: 7,
      altText: 'Test rally point',
    });

    for (const link of result.links) {
      expect(link.url).toBe(`https://ops.example/?mission_id=${result.missionId}`);
    }

    const decrypted = await decryptMission({
      asset: result.asset,
      commanderPublicKey: identity.publicKey,
      gameId: result.links[0]!.gameId,
      personalKey: result.links[0]!.personalKey,
    });

    expect(decrypted.ok).toBe(true);
    if (decrypted.ok) {
      expect(decrypted.mission).toEqual(sampleMission);
      expect(decrypted.heroImage).toEqual({
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
        mimeType: 'image/jpeg',
        altText: 'Test rally point',
      });
    }
  }, 60_000);
});
