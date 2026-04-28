// @ts-nocheck
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const DEV_TEST_COMMANDER_PRIVATE_JWK: JsonWebKey = {
  kty: 'OKP',
  crv: 'Ed25519',
  alg: 'Ed25519',
  key_ops: ['sign'],
  ext: true,
  d: '65lnHxaG5BZf_MjrwUCK-wW9IunfSIxd5kFV5Gzilmc',
  x: 'K2OiYxIl8Fj18xXYEQhmdK-b_4Z0WYdCWF_EqwgKr0g',
};

const exampleMission = {
  missionCommander: 'Cmdr. Vesper [leadingtw]',
  communicationChannel: 'Squadron Command / Vesper Relay',
  missionTime: '2026-05-01 22:00 GMT+8',
  rallyTime: '2026-05-01 21:30 GMT+8',
  rallyLocation: 'Orison - Providence Platform',
  requiredGear: 'Light fighter or dropship, medpen, tractor beam',
  accessPermission: 'Whitelisted pilots',
  rewardDistribution: 'Equal split after operational costs',
  missionBrief: 'Launch from Orison, secure relay beacon, then escort recovery team back to atmosphere.',
} as const;

const exampleHero = {
  bytes: new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
  ]),
  mimeType: 'image/jpeg',
  altText: 'Example mission beacon over Crusader',
} as const;

const exampleMembers = [
  { gameId: 'leadingtw' },
  { gameId: 'vesper_test' },
] as const;

async function main(): Promise<void> {
  const vite = await createServer({
    appType: 'custom',
    server: {
      middlewareMode: true,
      hmr: false,
    },
  });

  try {
    const { encryptMission } = await vite.ssrLoadModule('/src/crypto/index.ts') as {
      encryptMission: typeof import('../src/crypto/index').encryptMission;
    };

    const commanderPrivateKey = await crypto.subtle.importKey(
      'jwk',
      DEV_TEST_COMMANDER_PRIVATE_JWK,
      { name: 'Ed25519' },
      true,
      ['sign'],
    );

    const { asset, links } = await encryptMission({
      mission: exampleMission,
      heroImage: exampleHero,
      members: [...exampleMembers],
      commanderPrivateKey,
    });

    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
    const outputPath = resolve(repoRoot, 'public/missions/_example.json');

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(asset, null, 2)}\n`, 'utf8');

    console.log(`Wrote ${outputPath}`);
    for (const link of links) {
      console.log(`${link.gameId}: ${link.personalKey} ${link.url}`);
    }
  } finally {
    await vite.close();
  }
}

await main();
