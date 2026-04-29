import { z } from 'zod';

import type { CommanderIdentity } from './identity';

export interface FleetOpsApi {
  help(): void;
  launchAuthoring(): void;
  exportIdentity(): Promise<void>;
  importIdentity(jwk: object): Promise<{ publicKeyFingerprint: string }>;
  whoAmI(): Promise<{ publicKeyFingerprint: string } | null>;
}

export interface FleetOpsContext {
  openAuthoringModal: () => void;
  loadIdentity: () => Promise<CommanderIdentity | null>;
  exportIdentityJwk: () => Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | null>;
  importIdentityJwk: (jwk: { publicKey: JsonWebKey; privateKey: JsonWebKey }) => Promise<void>;
  getCommanderPublicKeyFingerprint: () => Promise<string | null>;
}

export const CONSOLE_BANNER = `
═══════════════════════════════════════════════════
  VESPER SQUAD // FLEET COMMAND ACCESS
  Type fleetOps.help() to begin
  ⚠️  Never paste console commands from untrusted
      sources. Authoring works only on your verified
      domain over HTTPS.
═══════════════════════════════════════════════════
`;

const publicKeyJwkSchema = z
  .object({
    kty: z.literal('OKP'),
    crv: z.literal('Ed25519'),
    x: z.string().min(1),
  })
  .passthrough();

const privateKeyJwkSchema = z
  .object({
    kty: z.literal('OKP'),
    crv: z.literal('Ed25519'),
    x: z.string().min(1),
    d: z.string().min(1),
  })
  .passthrough();

const identityBackupSchema = z.object({
  publicKey: publicKeyJwkSchema,
  privateKey: privateKeyJwkSchema,
});

const HELP_TEXT = [
  'fleetOps commands:',
  '  fleetOps.help()',
  '    Show available commands and safety guidance.',
  '  fleetOps.launchAuthoring()',
  '    Open the in-page mission authoring modal.',
  '  fleetOps.exportIdentity()',
  '    Download identity-backup.json with your current commander identity.',
  '  fleetOps.importIdentity(jwk)',
  '    Validate and import an exported commander identity backup.',
  '  fleetOps.whoAmI()',
  '    Show the current commander public key fingerprint.',
  '',
  'Safety:',
  '  Only use these commands on your verified HTTPS domain.',
  '  Never paste console commands from untrusted sources.',
  '  launchAuthoring() opens an in-page form and does not place mission data in console history.',
].join('\n');

export function createFleetOps(ctx: FleetOpsContext): FleetOpsApi {
  return {
    help() {
      console.log(HELP_TEXT);
    },
    launchAuthoring() {
      ctx.openAuthoringModal();
    },
    async exportIdentity() {
      const identity = await ctx.exportIdentityJwk();
      if (!identity) {
        throw new Error('No commander identity is stored');
      }

      triggerJsonDownload('identity-backup.json', {
        publicKey: identity.publicKey,
        privateKey: identity.privateKey,
        createdAt: new Date().toISOString(),
      });
    },
    async importIdentity(jwk: object) {
      const parsed = identityBackupSchema.parse(jwk);
      await ctx.importIdentityJwk(parsed);

      const publicKeyFingerprint = await ctx.getCommanderPublicKeyFingerprint();
      if (!publicKeyFingerprint) {
        throw new Error('Identity imported but fingerprint is unavailable');
      }

      return { publicKeyFingerprint };
    },
    async whoAmI() {
      const publicKeyFingerprint = await ctx.getCommanderPublicKeyFingerprint();
      return publicKeyFingerprint ? { publicKeyFingerprint } : null;
    },
  };
}

export function registerFleetOpsOnWindow(api: FleetOpsApi): void {
  window.fleetOps = api;
}

function triggerJsonDownload(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}

declare global {
  interface Window {
    fleetOps: FleetOpsApi;
  }
}
