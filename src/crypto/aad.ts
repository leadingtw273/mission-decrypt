import { canonicalJSON, utf8Encode } from './codec';

export interface CryptoParams {
  readonly kdf: 'PBKDF2-HMAC-SHA256';
  readonly kdfIterations: number;
  readonly kdfHash: 'SHA-256';
  readonly derivedKeyLength: number;
  readonly saltLength: number;
  readonly cipher: 'AES-256-GCM';
  readonly ivLength: number;
  readonly gcmTagLength: number;
  readonly encoding: 'base64url';
  readonly signature: 'Ed25519';
}

interface VersionedContext {
  schemaVersion: string;
  cryptoVersion: string;
  missionId: string;
  params: CryptoParams;
}

export function aadForWrap(ctx: VersionedContext & { lookupKey: string }): Uint8Array {
  return utf8Encode(
    canonicalJSON({
      schemaVersion: ctx.schemaVersion,
      cryptoVersion: ctx.cryptoVersion,
      missionId: ctx.missionId,
      purpose: 'wrap',
      lookupKey: ctx.lookupKey,
      params: ctx.params,
    }),
  );
}

export function aadForField(ctx: VersionedContext & { fieldName: string }): Uint8Array {
  return utf8Encode(
    canonicalJSON({
      schemaVersion: ctx.schemaVersion,
      cryptoVersion: ctx.cryptoVersion,
      missionId: ctx.missionId,
      purpose: 'field',
      fieldName: ctx.fieldName,
      params: ctx.params,
    }),
  );
}

export function aadForHero(
  ctx: VersionedContext & { mimeType: string; byteLength: number; altText: string },
): Uint8Array {
  return utf8Encode(
    canonicalJSON({
      schemaVersion: ctx.schemaVersion,
      cryptoVersion: ctx.cryptoVersion,
      missionId: ctx.missionId,
      purpose: 'field',
      fieldName: 'heroImage',
      mimeType: ctx.mimeType,
      byteLength: ctx.byteLength,
      altText: ctx.altText,
      params: ctx.params,
    }),
  );
}
