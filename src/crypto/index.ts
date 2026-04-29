import { aadForField, aadForHero, aadForWrap } from './aad';
import { canonicalJSON, fromBase64Url, hmacSha256, toBase64Url, utf8Encode, utf8Decode } from './codec';
import { aesGcmDecrypt, aesGcmEncrypt, exportMasterKey, generateMasterKey, importMasterKey } from './envelope';
import { DEFAULT_ITERATIONS, deriveWrapKey } from './kdf';
import { randomMissionId } from './missionId';
import { normalizeGameId } from './normalization';
import { generatePersonalKey, parsePersonalKey, validatePersonalKey } from './personalKey';
import {
  type DecryptErrorReason,
  FIELD_NAMES,
  type MemberInput,
  type MemberLink,
  type MissionAssetV1,
  type MissionPlaintext,
  parseMissionAsset,
} from './schema';
import { fingerprint, sign as ed25519Sign, verify as ed25519Verify } from './sign';

const SCHEMA_VERSION = '1';
const CRYPTO_VERSION = '1';
const LOOKUP_VERSION = '1';
const NORMALIZATION_VERSION = '1';

const DEFAULT_PARAMS = {
  kdf: 'PBKDF2-HMAC-SHA256',
  kdfIterations: DEFAULT_ITERATIONS,
  kdfHash: 'SHA-256',
  derivedKeyLength: 32,
  saltLength: 16,
  cipher: 'AES-256-GCM',
  ivLength: 12,
  gcmTagLength: 16,
  encoding: 'base64url',
  signature: 'Ed25519',
} as const;

export interface HeroImageInput {
  bytes: Uint8Array;
  mimeType: string;
  altText: string;
}

export async function encryptMission(input: {
  mission: MissionPlaintext;
  heroImage: HeroImageInput;
  members: MemberInput[];
  commanderPrivateKey: CryptoKey;
}): Promise<{ asset: MissionAssetV1; links: MemberLink[] }> {
  const { mission, heroImage, members, commanderPrivateKey } = input;

  // 1) Normalize members + check duplicates
  const normalizedMembers = members.map((m) => ({ raw: m.gameId, norm: normalizeGameId(m.gameId) }));
  const normSet = new Set<string>();
  for (const m of normalizedMembers) {
    if (normSet.has(m.norm)) throw new Error(`duplicate normalized gameId: ${m.norm}`);
    normSet.add(m.norm);
  }

  const missionId = randomMissionId();
  const createdAt = new Date().toISOString();
  const params = DEFAULT_PARAMS;

  // 2) Generate master key M
  const M = await generateMasterKey();

  // 3) Encrypt each field with M + AAD
  const usedIvs = new Set<string>();
  const fields: Record<string, { iv: string; ciphertext: string; charCount: number }> = {};
  for (const fieldName of FIELD_NAMES) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivKey = toBase64Url(iv);
    if (usedIvs.has(ivKey)) throw new Error('IV collision in single mission (RNG fault)');
    usedIvs.add(ivKey);
    const aad = aadForField({
      schemaVersion: SCHEMA_VERSION, cryptoVersion: CRYPTO_VERSION,
      missionId, fieldName, params,
    });
    const plaintext = mission[fieldName as keyof MissionPlaintext];
    const ct = await aesGcmEncrypt(M, iv, utf8Encode(plaintext), aad);
    fields[fieldName] = { iv: ivKey, ciphertext: toBase64Url(ct), charCount: plaintext.length };
  }

  // 4) Encrypt hero image (track heroIv in same Set as field IVs since they share key M)
  const heroIv = crypto.getRandomValues(new Uint8Array(12));
  const heroIvKey = toBase64Url(heroIv);
  if (usedIvs.has(heroIvKey)) throw new Error('IV collision in single mission (RNG fault)');
  usedIvs.add(heroIvKey);
  const heroAad = aadForHero({
    schemaVersion: SCHEMA_VERSION, cryptoVersion: CRYPTO_VERSION,
    missionId, params,
    mimeType: heroImage.mimeType, byteLength: heroImage.bytes.length, altText: heroImage.altText,
  });
  const heroCt = await aesGcmEncrypt(M, heroIv, heroImage.bytes, heroAad);

  // 5) Wrap M for each member
  const wrappedKeys: Record<string, { salt: string; iv: string; wrapped: string }> = {};
  const links: MemberLink[] = [];
  const Mraw = await exportMasterKey(M);

  for (const member of normalizedMembers) {
    const personalKey = generatePersonalKey();
    const personalKeyParsed = parsePersonalKey(personalKey);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrapKey = await deriveWrapKey(personalKeyParsed, salt, params.kdfIterations);

    const lookupKeyBytes = await hmacSha256(utf8Encode(missionId), utf8Encode(member.norm));
    const lookupKey = toBase64Url(lookupKeyBytes);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = aadForWrap({
      schemaVersion: SCHEMA_VERSION, cryptoVersion: CRYPTO_VERSION,
      missionId, lookupKey, params,
    });
    const wrapped = await aesGcmEncrypt(wrapKey, iv, Mraw, aad);

    wrappedKeys[lookupKey] = {
      salt: toBase64Url(salt),
      iv: toBase64Url(iv),
      wrapped: toBase64Url(wrapped),
    };
    links.push({
      gameId: member.raw,
      personalKey,
      url: `${typeof location !== 'undefined' ? location.origin : 'https://vesper.example'}/?mission_id=${missionId}`,
    });
  }

  // 6) Build asset (no signature yet)
  const assetWithoutSignature = {
    schemaVersion: SCHEMA_VERSION,
    cryptoVersion: CRYPTO_VERSION,
    lookupVersion: LOOKUP_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    missionId,
    createdAt,
    params,
    wrappedKeys,
    fields: fields as MissionAssetV1['fields'],
    heroImage: {
      iv: toBase64Url(heroIv),
      ciphertext: toBase64Url(heroCt),
      metadata: {
        mimeType: heroImage.mimeType,
        byteLength: heroImage.bytes.length,
        altText: heroImage.altText,
      },
    },
  } as const;

  // 7) Sign canonical JSON of asset_without_signature
  const signedBytes = utf8Encode(canonicalJSON(assetWithoutSignature));
  const signatureBytes = await ed25519Sign(commanderPrivateKey, signedBytes);

  const commanderPublicKey = await deriveCommanderPublicKey(commanderPrivateKey);
  const fp = await fingerprint(commanderPublicKey);

  const asset: MissionAssetV1 = {
    ...assetWithoutSignature,
    signature: {
      alg: 'Ed25519',
      publicKeyFingerprint: fp,
      value: toBase64Url(signatureBytes),
    },
  };

  return { asset, links };
}

export async function addMissionMember(input: {
  asset: MissionAssetV1;
  commanderPrivateKey: CryptoKey;
  knownGameId: string;
  knownPersonalKey: string;
  newMembers: MemberInput[];
}): Promise<{ asset: MissionAssetV1; links: MemberLink[] }> {
  const { asset, commanderPrivateKey, knownGameId, knownPersonalKey, newMembers } = input;

  if (newMembers.length === 0) {
    throw new Error('newMembers cannot be empty');
  }

  // Normalize and dedupe new members against themselves
  const normalizedNew = newMembers.map((m) => ({
    raw: m.gameId,
    norm: normalizeGameId(m.gameId),
  }));
  const seen = new Set<string>();
  for (const m of normalizedNew) {
    if (seen.has(m.norm)) throw new Error(`duplicate normalized gameId in newMembers: ${m.norm}`);
    seen.add(m.norm);
  }

  // 1) Recover M via known member's wrappedKey
  const knownNorm = normalizeGameId(knownGameId);
  const knownLookupKey = toBase64Url(
    await hmacSha256(utf8Encode(asset.missionId), utf8Encode(knownNorm)),
  );
  const knownWrapped = asset.wrappedKeys[knownLookupKey];
  if (!knownWrapped) {
    throw new Error('known member not found in this mission');
  }

  if (!validatePersonalKey(knownPersonalKey)) {
    throw new Error('invalid_personal_key_format');
  }

  const knownPkParsed = parsePersonalKey(knownPersonalKey);
  const knownWrapKey = await deriveWrapKey(
    knownPkParsed,
    fromBase64Url(knownWrapped.salt),
    asset.params.kdfIterations,
  );
  const knownAad = aadForWrap({
    schemaVersion: SCHEMA_VERSION,
    cryptoVersion: CRYPTO_VERSION,
    missionId: asset.missionId,
    lookupKey: knownLookupKey,
    params: asset.params,
  });

  let Mraw: Uint8Array;
  try {
    Mraw = await aesGcmDecrypt(
      knownWrapKey,
      fromBase64Url(knownWrapped.iv),
      fromBase64Url(knownWrapped.wrapped),
      knownAad,
    );
  } catch {
    throw new Error('failed to recover master key — known credentials invalid');
  }

  // 2) Wrap M for each new member
  const updatedWrappedKeys: Record<string, { salt: string; iv: string; wrapped: string }> = {
    ...asset.wrappedKeys,
  };
  const links: MemberLink[] = [];

  for (const newMember of normalizedNew) {
    const newLookupKey = toBase64Url(
      await hmacSha256(utf8Encode(asset.missionId), utf8Encode(newMember.norm)),
    );
    if (updatedWrappedKeys[newLookupKey]) {
      throw new Error(`gameId already a member: ${newMember.norm}`);
    }

    const newPersonalKey = generatePersonalKey();
    const newPkParsed = parsePersonalKey(newPersonalKey);
    const salt = crypto.getRandomValues(new Uint8Array(asset.params.saltLength));
    const newWrapKey = await deriveWrapKey(newPkParsed, salt, asset.params.kdfIterations);
    const newIv = crypto.getRandomValues(new Uint8Array(asset.params.ivLength));
    const newAad = aadForWrap({
      schemaVersion: SCHEMA_VERSION,
      cryptoVersion: CRYPTO_VERSION,
      missionId: asset.missionId,
      lookupKey: newLookupKey,
      params: asset.params,
    });
    const wrapped = await aesGcmEncrypt(newWrapKey, newIv, Mraw, newAad);

    updatedWrappedKeys[newLookupKey] = {
      salt: toBase64Url(salt),
      iv: toBase64Url(newIv),
      wrapped: toBase64Url(wrapped),
    };
    links.push({
      gameId: newMember.raw,
      personalKey: newPersonalKey,
      url: `${typeof location !== 'undefined' ? location.origin : 'https://vesper.example'}/?mission_id=${asset.missionId}`,
    });
  }

  // 3) Build asset_without_signature with updated wrappedKeys; everything else
  // (fields ciphertext, heroImage, params, missionId, etc.) stays untouched.
  const { signature: _oldSig, ...assetWithoutSignature } = asset;
  void _oldSig;
  const updatedAssetWithoutSig = {
    ...assetWithoutSignature,
    wrappedKeys: updatedWrappedKeys,
  };

  // 4) Re-sign canonical JSON
  const signedBytes = utf8Encode(canonicalJSON(updatedAssetWithoutSig));
  const signatureBytes = await ed25519Sign(commanderPrivateKey, signedBytes);
  const commanderPublicKey = await deriveCommanderPublicKey(commanderPrivateKey);
  const fp = await fingerprint(commanderPublicKey);

  const newAsset: MissionAssetV1 = {
    ...updatedAssetWithoutSig,
    signature: {
      alg: 'Ed25519',
      publicKeyFingerprint: fp,
      value: toBase64Url(signatureBytes),
    },
  };

  return { asset: newAsset, links };
}

async function deriveCommanderPublicKey(privateKey: CryptoKey): Promise<CryptoKey> {
  // Web Crypto requires deriving public key from JWK export (strip the 'd' private field)
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  // Ed25519 JWK from exportKey always has kty/crv/x; non-null assertions reflect that contract.
  const pubJwk: JsonWebKey = { kty: jwk.kty!, crv: jwk.crv!, x: jwk.x! };
  return crypto.subtle.importKey('jwk', pubJwk, { name: 'Ed25519' }, true, ['verify']);
}

export async function decryptMission(input: {
  asset: unknown;
  commanderPublicKey: CryptoKey;
  gameId: string;
  personalKey: string;
}): Promise<
  | { ok: true; mission: MissionPlaintext; heroImage: { mimeType: string; bytes: Uint8Array; altText: string } }
  | { ok: false; reason: DecryptErrorReason }
> {
  // 1) Schema parse
  const parsed = parseMissionAsset(input.asset);
  if (!parsed.ok) return { ok: false, reason: 'invalid_asset' };
  const asset = parsed.value;

  // 2) Verify signature
  const { signature, ...rest } = asset;
  const signedBytes = utf8Encode(canonicalJSON(rest));
  let sigBytes: Uint8Array;
  try {
    sigBytes = fromBase64Url(signature.value);
  } catch {
    return { ok: false, reason: 'invalid_asset' };
  }
  const sigOk = await ed25519Verify(input.commanderPublicKey, signedBytes, sigBytes);
  if (!sigOk) return { ok: false, reason: 'forged_asset' };

  // 3) Validate personalKey format
  if (!validatePersonalKey(input.personalKey)) {
    return { ok: false, reason: 'invalid_personal_key_format' };
  }

  // 4) Normalize gameId, compute lookupKey
  let normGameId: string;
  try {
    normGameId = normalizeGameId(input.gameId);
  } catch {
    return { ok: false, reason: 'auth_failed' };
  }
  const lookupKeyBytes = await hmacSha256(utf8Encode(asset.missionId), utf8Encode(normGameId));
  const lookupKey = toBase64Url(lookupKeyBytes);

  const wrapped = asset.wrappedKeys[lookupKey];
  if (!wrapped) return { ok: false, reason: 'auth_failed' };

  // 5) Unwrap M
  const personalKeyParsed = parsePersonalKey(input.personalKey);
  const wrapKey = await deriveWrapKey(personalKeyParsed, fromBase64Url(wrapped.salt), asset.params.kdfIterations);
  const wrapAad = aadForWrap({
    schemaVersion: asset.schemaVersion, cryptoVersion: asset.cryptoVersion,
    missionId: asset.missionId, lookupKey, params: asset.params,
  });

  let Mraw: Uint8Array;
  try {
    Mraw = await aesGcmDecrypt(wrapKey, fromBase64Url(wrapped.iv), fromBase64Url(wrapped.wrapped), wrapAad);
  } catch {
    return { ok: false, reason: 'auth_failed' };
  }
  const M = await importMasterKey(Mraw);

  // 6) Decrypt all fields
  const mission: Record<string, string> = {};
  for (const fieldName of FIELD_NAMES) {
    const f = asset.fields[fieldName];
    const aad = aadForField({
      schemaVersion: asset.schemaVersion, cryptoVersion: asset.cryptoVersion,
      missionId: asset.missionId, fieldName, params: asset.params,
    });
    try {
      const pt = await aesGcmDecrypt(M, fromBase64Url(f.iv), fromBase64Url(f.ciphertext), aad);
      mission[fieldName] = utf8Decode(pt);
    } catch {
      return { ok: false, reason: 'cipher_corrupt' };
    }
  }

  // 7) Decrypt hero
  const heroAad = aadForHero({
    schemaVersion: asset.schemaVersion, cryptoVersion: asset.cryptoVersion,
    missionId: asset.missionId, params: asset.params,
    mimeType: asset.heroImage.metadata.mimeType,
    byteLength: asset.heroImage.metadata.byteLength,
    altText: asset.heroImage.metadata.altText,
  });
  let heroBytes: Uint8Array;
  try {
    heroBytes = await aesGcmDecrypt(
      M,
      fromBase64Url(asset.heroImage.iv),
      fromBase64Url(asset.heroImage.ciphertext),
      heroAad,
    );
  } catch {
    return { ok: false, reason: 'cipher_corrupt' };
  }

  return {
    ok: true,
    mission: mission as MissionPlaintext,
    heroImage: {
      mimeType: asset.heroImage.metadata.mimeType,
      bytes: heroBytes,
      altText: asset.heroImage.metadata.altText,
    },
  };
}

export type { MissionAssetV1, MissionPlaintext, MemberInput, MemberLink, DecryptErrorReason } from './schema';
export { parseMissionAsset } from './schema';
export { generatePersonalKey, validatePersonalKey } from './personalKey';
export { normalizeGameId } from './normalization';
