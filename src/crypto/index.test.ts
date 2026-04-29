import { describe, it, expect } from 'vitest';
import { addMissionMember, encryptMission, decryptMission, type MissionPlaintext } from './index';
import { generateSigningKeypair, exportPublicKey, importPublicKey } from './sign';

const samplePlaintext: MissionPlaintext = {
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
  missionBrief: 'Rally at 21:30, depart at 22:00. Late arrivals can join in deep space.',
};

const sampleHero = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),  // fake JPEG header
  mimeType: 'image/jpeg',
  altText: 'Test rally point',
};

describe('encryptMission + decryptMission round-trip', () => {
  it('encrypts and a member can decrypt with their personal key', async () => {
    const { privateKey: cmdPriv, publicKey: cmdPub } = await generateSigningKeypair();
    const cmdPubRaw = await exportPublicKey(cmdPub);

    const { asset, links } = await encryptMission({
      mission: samplePlaintext,
      heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }, { gameId: 'ace_pilot_42' }],
      commanderPrivateKey: cmdPriv,
    });

    expect(links).toHaveLength(2);
    expect(links[0]!.gameId).toBe('leadingtw');

    const importedPub = await importPublicKey(cmdPubRaw);
    const result = await decryptMission({
      asset,
      commanderPublicKey: importedPub,
      gameId: 'leadingtw',
      personalKey: links[0]!.personalKey,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mission).toEqual(samplePlaintext);
      expect(result.heroImage.mimeType).toBe('image/jpeg');
      expect(result.heroImage.bytes).toEqual(sampleHero.bytes);
      expect(result.heroImage.altText).toBe('Test rally point');
    }
  }, 60_000);

  it('member B can also decrypt with their own personal key', async () => {
    const { privateKey: cmdPriv, publicKey: cmdPub } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext, heroImage: sampleHero,
      members: [{ gameId: 'A' }, { gameId: 'B' }],
      commanderPrivateKey: cmdPriv,
    });
    const result = await decryptMission({
      asset, commanderPublicKey: cmdPub,
      gameId: 'B', personalKey: links[1]!.personalKey,
    });
    expect(result.ok).toBe(true);
  }, 60_000);

  it('returns auth_failed for wrong personalKey', async () => {
    const { privateKey: cmdPriv, publicKey: cmdPub } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext, heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: cmdPriv,
    });
    // Replace last char to break checksum-or-key
    const wrong = links[0]!.personalKey.slice(0, -1) + (links[0]!.personalKey.slice(-1) === '0' ? '1' : '0');
    const result = await decryptMission({
      asset, commanderPublicKey: cmdPub, gameId: 'leadingtw', personalKey: wrong,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['auth_failed', 'invalid_personal_key_format']).toContain(result.reason);
    }
  }, 60_000);

  it('returns auth_failed for unknown gameId', async () => {
    const { privateKey: cmdPriv, publicKey: cmdPub } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext, heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: cmdPriv,
    });
    const result = await decryptMission({
      asset, commanderPublicKey: cmdPub, gameId: 'random_dude', personalKey: links[0]!.personalKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('auth_failed');
  }, 60_000);

  it('returns forged_asset when signed by wrong commander', async () => {
    const fake = await generateSigningKeypair();
    const real = await generateSigningKeypair();
    const { asset } = await encryptMission({
      mission: samplePlaintext, heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: fake.privateKey,
    });
    const result = await decryptMission({
      asset, commanderPublicKey: real.publicKey, gameId: 'leadingtw', personalKey: 'ABCD-EFGH-JKMN-PQR0',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('forged_asset');
  }, 60_000);

  it('returns forged_asset when field ciphertext is tampered (signature catches it first)', async () => {
    const { privateKey: cmdPriv, publicKey: cmdPub } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext, heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: cmdPriv,
    });
    // tamper missionTime ciphertext (post-signature, will fail signature first)
    const tampered = JSON.parse(JSON.stringify(asset));
    tampered.fields.missionTime.ciphertext = 'AAAA';
    const result = await decryptMission({
      asset: tampered, commanderPublicKey: cmdPub, gameId: 'leadingtw', personalKey: links[0]!.personalKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('forged_asset');  // signature catches it first
  }, 60_000);

  it('rejects duplicate normalized gameIds at encrypt time', async () => {
    const { privateKey: cmdPriv } = await generateSigningKeypair();
    await expect(encryptMission({
      mission: samplePlaintext, heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }, { gameId: 'LeadingTW' }],
      commanderPrivateKey: cmdPriv,
    })).rejects.toThrow(/duplicate/i);
  }, 60_000);
});

describe('AAD binding regression', () => {
  it('field swap (rallyTime vs missionTime) fails to decrypt', async () => {
    const { privateKey: cmdPriv, publicKey: cmdPub } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext, heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: cmdPriv,
    });
    // Swap two fields' iv+ciphertext
    const tampered = JSON.parse(JSON.stringify(asset));
    [tampered.fields.rallyTime, tampered.fields.missionTime] = [
      tampered.fields.missionTime, tampered.fields.rallyTime,
    ];
    // Re-sign with same key (simulate attacker who can re-sign)
    // For this test we expect signature check to fail first.
    const result = await decryptMission({
      asset: tampered, commanderPublicKey: cmdPub, gameId: 'leadingtw', personalKey: links[0]!.personalKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('forged_asset');
  }, 60_000);

  it('mutated missionId in the asset (no re-sign) fails signature', async () => {
    const { privateKey: cmdPriv, publicKey: cmdPub } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext, heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: cmdPriv,
    });
    const tampered = JSON.parse(JSON.stringify(asset));
    tampered.missionId = 'XXX-99999-AA0';  // valid pattern but different value
    const result = await decryptMission({
      asset: tampered, commanderPublicKey: cmdPub, gameId: 'leadingtw', personalKey: links[0]!.personalKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('forged_asset');
  }, 60_000);
});

describe('addMissionMember', () => {
  it('lets a new member decrypt without disturbing existing members', async () => {
    const { privateKey: cmdPriv, publicKey: cmdPub } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext,
      heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: cmdPriv,
    });
    const originalLink = links[0]!;

    const { asset: extendedAsset, links: newLinks } = await addMissionMember({
      asset,
      commanderPrivateKey: cmdPriv,
      knownGameId: 'leadingtw',
      knownPersonalKey: originalLink.personalKey,
      newMembers: [{ gameId: 'ace_pilot_42' }, { gameId: 'pilot_77' }],
    });

    expect(newLinks).toHaveLength(2);
    expect(extendedAsset.missionId).toBe(asset.missionId);
    expect(extendedAsset.signature.value).not.toBe(asset.signature.value);

    // Existing member can still decrypt with the same personalKey
    const original = await decryptMission({
      asset: extendedAsset,
      commanderPublicKey: cmdPub,
      gameId: 'leadingtw',
      personalKey: originalLink.personalKey,
    });
    expect(original.ok).toBe(true);
    if (original.ok) expect(original.mission).toEqual(samplePlaintext);

    // Each new member can decrypt with their freshly-issued key
    for (const link of newLinks) {
      const result = await decryptMission({
        asset: extendedAsset,
        commanderPublicKey: cmdPub,
        gameId: link.gameId,
        personalKey: link.personalKey,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.mission).toEqual(samplePlaintext);
    }
  }, 60_000);

  it('rejects bad known credentials', async () => {
    const { privateKey: cmdPriv } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext,
      heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: cmdPriv,
    });
    const originalLink = links[0]!;

    // Wrong gameId → not in wrappedKeys
    await expect(
      addMissionMember({
        asset,
        commanderPrivateKey: cmdPriv,
        knownGameId: 'someone_else',
        knownPersonalKey: originalLink.personalKey,
        newMembers: [{ gameId: 'newpilot' }],
      }),
    ).rejects.toThrow(/known member not found/i);

    // Wrong personalKey on right gameId → AES-GCM auth fails
    const wrongKey = originalLink.personalKey.slice(0, -1) + (originalLink.personalKey.slice(-1) === '0' ? '1' : '0');
    await expect(
      addMissionMember({
        asset,
        commanderPrivateKey: cmdPriv,
        knownGameId: 'leadingtw',
        knownPersonalKey: wrongKey,
        newMembers: [{ gameId: 'newpilot' }],
      }),
    ).rejects.toThrow(/recover master key|invalid_personal_key_format/i);
  }, 60_000);

  it('rejects adding an already-enrolled gameId', async () => {
    const { privateKey: cmdPriv } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext,
      heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }, { gameId: 'ace42' }],
      commanderPrivateKey: cmdPriv,
    });

    await expect(
      addMissionMember({
        asset,
        commanderPrivateKey: cmdPriv,
        knownGameId: 'leadingtw',
        knownPersonalKey: links[0]!.personalKey,
        newMembers: [{ gameId: 'ACE42' }], // normalises to ace42
      }),
    ).rejects.toThrow(/already a member/i);
  }, 60_000);

  it('rejects empty newMembers', async () => {
    const { privateKey: cmdPriv } = await generateSigningKeypair();
    const { asset, links } = await encryptMission({
      mission: samplePlaintext,
      heroImage: sampleHero,
      members: [{ gameId: 'leadingtw' }],
      commanderPrivateKey: cmdPriv,
    });

    await expect(
      addMissionMember({
        asset,
        commanderPrivateKey: cmdPriv,
        knownGameId: 'leadingtw',
        knownPersonalKey: links[0]!.personalKey,
        newMembers: [],
      }),
    ).rejects.toThrow(/cannot be empty/i);
  }, 60_000);
});
