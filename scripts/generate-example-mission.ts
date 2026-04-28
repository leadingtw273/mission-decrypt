// @ts-nocheck
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
  missionCommander: '老周【leadingtw】',
  communicationChannel: '戰略頻道 > 星際遨遊',
  missionTime: '21:00 - 23:00 (GMT+8)',
  rallyTime: '20:30 (GMT+8)',
  rallyLocation: '奧里森空域，進入隊伍跳點',
  requiredGear: '隨意，自身主武器彈藥備足(約40匣)',
  accessPermission: '所有人，若有阿波蘿，請開阿波蘿與備好隊伍凝膠到指定地點',
  rewardDistribution: '酣暢淋漓的槍戰體驗',
  missionBrief: '深空集合，比較晚到的可以匯合加入遊戲',
} as const;

const HERO_IMAGE_PATH = 'scripts/assets/hero-image.png';
const HERO_IMAGE_MIME = 'image/png';
const HERO_IMAGE_ALT = '奧里森空域集合點';

const exampleMembers = [
  { gameId: 'leadingtw' },
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

    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
    const heroBytes = new Uint8Array(await readFile(resolve(repoRoot, HERO_IMAGE_PATH)));

    const { asset, links } = await encryptMission({
      mission: exampleMission,
      heroImage: { bytes: heroBytes, mimeType: HERO_IMAGE_MIME, altText: HERO_IMAGE_ALT },
      members: [...exampleMembers],
      commanderPrivateKey,
    });

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
