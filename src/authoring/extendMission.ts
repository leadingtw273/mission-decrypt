import {
  addMissionMember,
  type MemberInput,
  type MemberLink,
  type MissionAssetV1,
} from '../crypto';

export interface ExtendMissionInput {
  asset: MissionAssetV1;
  identity: { privateKey: CryptoKey };
  knownGameId: string;
  knownPersonalKey: string;
  newMembers: MemberInput[];
  baseUrl?: string;
}

export interface ExtendMissionResult {
  asset: MissionAssetV1;
  links: MemberLink[];
  missionId: string;
}

export async function extendMission(input: ExtendMissionInput): Promise<ExtendMissionResult> {
  const { asset, identity, knownGameId, knownPersonalKey, newMembers, baseUrl } = input;

  const { asset: extendedAsset, links } = await addMissionMember({
    asset,
    commanderPrivateKey: identity.privateKey,
    knownGameId,
    knownPersonalKey,
    newMembers,
  });

  const mappedLinks = baseUrl ? overrideLinks(links, baseUrl, asset.missionId) : links;

  return {
    asset: extendedAsset,
    links: mappedLinks,
    missionId: asset.missionId,
  };
}

function overrideLinks(links: MemberLink[], baseUrl: string, missionId: string): MemberLink[] {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }

  return links.map((link) => ({
    ...link,
    url: `${url.toString()}?mission_id=${missionId}`,
  }));
}
