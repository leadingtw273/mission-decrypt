import { type DecryptErrorReason, type MissionAssetV1, type MissionPlaintext } from '../crypto';

export interface DecryptedHeroImage {
  mimeType: string;
  bytes: Uint8Array;
  altText: string;
}

export type State =
  | { kind: 'BOOTSTRAPPING' }
  | { kind: 'ASSET_LOADING'; missionId: string }
  | { kind: 'LOCKED'; missionId: string; asset: MissionAssetV1 }
  | { kind: 'DECRYPTING'; missionId: string; asset: MissionAssetV1; gameId: string; personalKey: string }
  | { kind: 'DECRYPTED'; asset: MissionAssetV1; mission: MissionPlaintext; heroImage: DecryptedHeroImage }
  | { kind: 'ERROR'; reason: DecryptErrorReason; retryable: boolean; lastAsset?: MissionAssetV1 };

type AssetFailedReason = 'not_found' | 'invalid_asset' | 'forged_asset' | 'unsupported_version';
type DecryptFailReason = 'auth_failed' | 'cipher_corrupt' | 'invalid_personal_key_format';

export type Action =
  | { type: 'ENV_OK'; missionId: string }
  | { type: 'ENV_FAIL' }
  | { type: 'ASSET_LOADED'; asset: MissionAssetV1 }
  | { type: 'ASSET_FAILED'; reason: AssetFailedReason }
  | { type: 'SUBMIT'; gameId: string; personalKey: string }
  | { type: 'DECRYPT_OK'; asset: MissionAssetV1; mission: MissionPlaintext; heroImage: DecryptedHeroImage }
  | { type: 'DECRYPT_FAIL'; reason: DecryptFailReason }
  | { type: 'RETRY' };

export const initialState: State = { kind: 'BOOTSTRAPPING' };

export function reducer(state: State, action: Action): State {
  switch (state.kind) {
    case 'BOOTSTRAPPING':
      if (action.type === 'ENV_OK') {
        return { kind: 'ASSET_LOADING', missionId: action.missionId };
      }
      if (action.type === 'ENV_FAIL') {
        return { kind: 'ERROR', reason: 'unsupported_env', retryable: false };
      }
      return warnInvalidTransition(state, action);

    case 'ASSET_LOADING':
      if (action.type === 'ASSET_LOADED') {
        return {
          kind: 'LOCKED',
          missionId: state.missionId,
          asset: action.asset,
        };
      }
      if (action.type === 'ASSET_FAILED') {
        return assetLoadErrorState(action.reason);
      }
      return warnInvalidTransition(state, action);

    case 'LOCKED':
      if (action.type === 'SUBMIT') {
        return {
          kind: 'DECRYPTING',
          missionId: state.missionId,
          asset: state.asset,
          gameId: action.gameId,
          personalKey: action.personalKey,
        };
      }
      return warnInvalidTransition(state, action);

    case 'DECRYPTING':
      if (action.type === 'DECRYPT_OK') {
        return {
          kind: 'DECRYPTED',
          asset: action.asset,
          mission: action.mission,
          heroImage: action.heroImage,
        };
      }
      if (action.type === 'DECRYPT_FAIL') {
        return decryptErrorState(action.reason, state.asset);
      }
      return warnInvalidTransition(state, action);

    case 'DECRYPTED':
      return warnInvalidTransition(state, action);

    case 'ERROR':
      if (action.type === 'RETRY') {
        if (state.lastAsset) {
          return {
            kind: 'LOCKED',
            missionId: state.lastAsset.missionId,
            asset: state.lastAsset,
          };
        }
        return initialState;
      }
      return warnInvalidTransition(state, action);
  }
}

function assetLoadErrorState(reason: AssetFailedReason): State {
  if (reason === 'not_found') {
    return { kind: 'ERROR', reason, retryable: true };
  }
  return { kind: 'ERROR', reason, retryable: false };
}

function decryptErrorState(reason: DecryptFailReason, asset: MissionAssetV1): State {
  if (reason === 'auth_failed' || reason === 'invalid_personal_key_format') {
    return {
      kind: 'ERROR',
      reason,
      retryable: true,
      lastAsset: asset,
    };
  }
  return { kind: 'ERROR', reason, retryable: false };
}

function warnInvalidTransition(state: State, action: Action): State {
  console.warn('Invalid decryption state transition', { state, action });
  return state;
}
