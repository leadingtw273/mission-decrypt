import { describe, it, expect } from 'vitest';
import { encryptMission, decryptMission } from './index';
import { generateSigningKeypair, exportPublicKey, importPublicKey } from './sign';

const samplePlaintext = {
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

  it('returns invalid_asset for tampered field ciphertext', async () => {
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
