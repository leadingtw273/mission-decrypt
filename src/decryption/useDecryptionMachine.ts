import { useEffect, useReducer } from 'react';

import { decryptMission } from '../crypto';
import { getCommanderPublicKey } from '../publicKeys/commanderPublicKey';
import { loadAsset } from './loadAsset';
import { initialState, reducer, type State } from './state';

export function useDecryptionMachine(missionId: string | null): {
  state: State;
  submit: (gameId: string, personalKey: string) => void;
  retry: () => void;
} {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (state.kind !== 'BOOTSTRAPPING') {
      return;
    }
    if (!missionId) {
      dispatch({ type: 'ENV_FAIL', reason: 'missing_mission_id' });
      return;
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      dispatch({ type: 'ENV_FAIL', reason: 'unsupported_env' });
      return;
    }
    dispatch({ type: 'ENV_OK', missionId });
  }, [missionId, state.kind]);

  useEffect(() => {
    if (state.kind !== 'ASSET_LOADING') {
      return;
    }

    let cancelled = false;
    const currentMissionId = state.missionId;

    void (async () => {
      const commanderPublicKey = await getCommanderPublicKey();
      const result = await loadAsset(currentMissionId, commanderPublicKey);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        dispatch({ type: 'ASSET_LOADED', asset: result.asset });
        return;
      }
      dispatch({ type: 'ASSET_FAILED', reason: result.reason });
    })();

    return () => {
      cancelled = true;
    };
  }, [state.kind, state.kind === 'ASSET_LOADING' ? state.missionId : null]);

  useEffect(() => {
    if (state.kind !== 'DECRYPTING') {
      return;
    }

    let cancelled = false;
    const { asset, gameId, personalKey } = state;

    void (async () => {
      const commanderPublicKey = await getCommanderPublicKey();
      const result = await decryptMission({
        asset,
        commanderPublicKey,
        gameId,
        personalKey,
      });
      if (cancelled) {
        return;
      }
      if (result.ok) {
        dispatch({
          type: 'DECRYPT_OK',
          asset,
          mission: result.mission,
          heroImage: result.heroImage,
        });
        return;
      }
      if (isDecryptFailReason(result.reason)) {
        dispatch({ type: 'DECRYPT_FAIL', reason: result.reason });
        return;
      }
      console.warn('Unexpected decryptMission failure during DECRYPTING state', {
        reason: result.reason,
      });
      dispatch({ type: 'DECRYPT_FAIL', reason: 'cipher_corrupt' });
    })();

    return () => {
      cancelled = true;
    };
  }, [state.kind]);

  return {
    state,
    submit: (gameId, personalKey) => {
      dispatch({ type: 'SUBMIT', gameId, personalKey });
    },
    retry: () => {
      if (state.kind === 'ERROR' && state.retryable) {
        dispatch({ type: 'RETRY' });
      }
    },
  };
}

function isDecryptFailReason(
  reason: string,
): reason is 'auth_failed' | 'cipher_corrupt' | 'invalid_personal_key_format' {
  return reason === 'auth_failed'
    || reason === 'cipher_corrupt'
    || reason === 'invalid_personal_key_format';
}
