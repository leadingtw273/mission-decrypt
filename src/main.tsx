import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App';
import {
  CONSOLE_BANNER,
  createFleetOps,
  registerFleetOpsOnWindow,
} from './authoring/fleetOps';
import {
  exportIdentityJwk,
  getCommanderPublicKeyFingerprint,
  importIdentityJwk,
  loadIdentity,
} from './authoring/identity';
import { encryptMission, decryptMission } from './crypto';
import { generateSigningKeypair } from './crypto/sign';

if (new URLSearchParams(location.search).has('cross-browser-harness')) {
  // Expose for Playwright tests only when explicitly requested
  (window as unknown as { __harness: unknown }).__harness = {
    async run() {
      try {
        const { privateKey, publicKey } = await generateSigningKeypair();
        const { asset, links } = await encryptMission({
          mission: {
            missionCommander: 'Test', communicationChannel: 'X', missionTime: 'Y',
            rallyTime: 'Z', rallyLocation: 'W', requiredGear: 'V',
            accessPermission: 'U', rewardDistribution: 'T', missionBrief: 'S',
          },
          heroImage: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg', altText: 'a' },
          members: [{ gameId: 'tester' }],
          commanderPrivateKey: privateKey,
        });
        const result = await decryptMission({
          asset, commanderPublicKey: publicKey,
          gameId: 'tester', personalKey: links[0]!.personalKey,
        });
        if (!result.ok) return { ok: false, reason: result.reason };
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: String(e) };
      }
    },
  };
}

console.log(CONSOLE_BANNER);

const fleetOps = createFleetOps({
  openAuthoringModal() {
    window.dispatchEvent(new CustomEvent('fleetops:open-authoring'));
  },
  loadIdentity,
  exportIdentityJwk,
  importIdentityJwk,
  getCommanderPublicKeyFingerprint,
});

registerFleetOpsOnWindow(fleetOps);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
