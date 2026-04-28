import { canonicalJSON, fromBase64Url, utf8Encode } from '../crypto/codec';
import { type MissionAssetV1, parseMissionAsset } from '../crypto/schema';
import { verify } from '../crypto/sign';

export type LoadResult =
  | { ok: true; asset: MissionAssetV1 }
  | { ok: false; reason: 'not_found' | 'invalid_asset' | 'forged_asset' | 'unsupported_version' };

const SUPPORTED_SCHEMA_VERSION = '1';

export async function loadAsset(
  missionId: string,
  commanderPublicKey: CryptoKey,
): Promise<LoadResult> {
  let response: Response;
  try {
    response = await fetch(`/missions/${missionId}.json?v=${SUPPORTED_SCHEMA_VERSION}`);
  } catch {
    return { ok: false, reason: 'not_found' };
  }

  if (!response.ok) {
    return { ok: false, reason: 'not_found' };
  }

  let rawAsset: unknown;
  try {
    rawAsset = await response.json();
  } catch {
    return { ok: false, reason: 'invalid_asset' };
  }

  if (hasUnsupportedSchemaVersion(rawAsset)) {
    return { ok: false, reason: 'unsupported_version' };
  }

  const parsed = parseMissionAsset(rawAsset);
  if (!parsed.ok) {
    return { ok: false, reason: 'invalid_asset' };
  }

  const asset = parsed.value;
  const { signature, ...assetWithoutSignature } = asset;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = fromBase64Url(signature.value);
  } catch {
    return { ok: false, reason: 'invalid_asset' };
  }

  const signedBytes = utf8Encode(canonicalJSON(assetWithoutSignature));
  const verified = await verify(commanderPublicKey, signedBytes, signatureBytes);
  if (!verified) {
    return { ok: false, reason: 'forged_asset' };
  }

  return { ok: true, asset };
}

function hasUnsupportedSchemaVersion(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  return 'schemaVersion' in input
    && typeof input.schemaVersion === 'string'
    && input.schemaVersion !== SUPPORTED_SCHEMA_VERSION;
}
