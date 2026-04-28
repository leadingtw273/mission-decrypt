import { encryptMission, type MemberInput, type MemberLink, type MissionAssetV1, type MissionPlaintext } from '../crypto';

import type { CommanderIdentity } from './identity';
import type { PickedImage } from './pickImage';

export interface GenerateMissionInput {
  mission: MissionPlaintext;
  heroImage: PickedImage;
  members: MemberInput[];
  identity: Pick<CommanderIdentity, 'privateKey'>;
  baseUrl?: string;
}

export interface GenerateMissionResult {
  missionId: string;
  asset: MissionAssetV1;
  links: MemberLink[];
}

export async function generateMission(input: GenerateMissionInput): Promise<GenerateMissionResult> {
  const { asset, links } = await encryptMission({
    mission: input.mission,
    heroImage: input.heroImage,
    members: input.members,
    commanderPrivateKey: input.identity.privateKey,
  });

  return {
    missionId: asset.missionId,
    asset,
    links: input.baseUrl ? overrideLinkBaseUrl(links, input.baseUrl, asset.missionId) : links,
  };
}

function overrideLinkBaseUrl(links: MemberLink[], baseUrl: string, missionId: string): MemberLink[] {
  const url = new URL(baseUrl);
  url.pathname = '/';
  url.search = '';
  url.hash = '';

  return links.map((link) => ({
    ...link,
    url: `${url.toString()}?mission_id=${missionId}`,
  }));
}
