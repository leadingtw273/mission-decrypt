import { z } from 'zod';

export const FIELD_NAMES = [
  'classification',
  'missionCommander',
  'communicationChannel',
  'missionTime',
  'rallyTime',
  'rallyLocation',
  'requiredGear',
  'accessPermission',
  'rewardDistribution',
  'missionBrief',
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export const CLASSIFICATION_VALUES = ['extreme', 'high', 'low'] as const;
export type ClassificationLevel = (typeof CLASSIFICATION_VALUES)[number];

const MISSION_ID_PATTERN = /^[A-Z]{3}-[A-Z0-9]{5}-[A-Z]{2}[0-9]$/;

const Base64Url = z.string().regex(/^[A-Za-z0-9_-]*$/);

export const CryptoParamsSchema = z.object({
  kdf: z.literal('PBKDF2-HMAC-SHA256'),
  kdfIterations: z.number().int().positive(),
  kdfHash: z.literal('SHA-256'),
  derivedKeyLength: z.literal(32),
  saltLength: z.literal(16),
  cipher: z.literal('AES-256-GCM'),
  ivLength: z.literal(12),
  gcmTagLength: z.literal(16),
  encoding: z.literal('base64url'),
  signature: z.literal('Ed25519'),
});

const EncryptedField = z.object({
  iv: Base64Url,
  ciphertext: Base64Url,
});

const WrappedKeyEntry = z.object({
  salt: Base64Url,
  iv: Base64Url,
  wrapped: Base64Url,
});

const HeroImage = z.object({
  iv: Base64Url,
  ciphertext: Base64Url,
  metadata: z.object({
    mimeType: z.string().min(1),
    byteLength: z.number().int().nonnegative(),
    altText: z.string(),
  }),
});

const Signature = z.object({
  alg: z.literal('Ed25519'),
  publicKeyFingerprint: z.string(),
  value: Base64Url,
});

const FieldsSchema = z.object(
  Object.fromEntries(FIELD_NAMES.map((n) => [n, EncryptedField])) as Record<FieldName, typeof EncryptedField>,
);

export const MissionAssetV1Schema = z.object({
  schemaVersion: z.literal('1'),
  cryptoVersion: z.literal('1'),
  lookupVersion: z.literal('1'),
  normalizationVersion: z.literal('1'),
  missionId: z.string().regex(MISSION_ID_PATTERN),
  createdAt: z.string().datetime(),
  params: CryptoParamsSchema,
  wrappedKeys: z.record(z.string(), WrappedKeyEntry),
  fields: FieldsSchema,
  heroImage: HeroImage,
  signature: Signature,
});

export type MissionAssetV1 = z.infer<typeof MissionAssetV1Schema>;

export const MissionPlaintextSchema = z.object(
  Object.fromEntries(FIELD_NAMES.map((n) => [n, z.string()])) as Record<FieldName, z.ZodString>,
);

export type MissionPlaintext = z.infer<typeof MissionPlaintextSchema>;

export interface MemberInput {
  gameId: string;
}

export interface MemberLink {
  gameId: string;
  personalKey: string;
  url: string;
}

export type DecryptErrorReason =
  | 'missing_mission_id'
  | 'not_found'
  | 'invalid_asset'
  | 'unsupported_env'
  | 'unsupported_version'
  | 'forged_asset'
  | 'auth_failed'
  | 'cipher_corrupt'
  | 'invalid_personal_key_format';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseMissionAsset(input: unknown): ParseResult<MissionAssetV1> {
  const result = MissionAssetV1Schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.message };
}
