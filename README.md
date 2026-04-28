# Vesper Mission

Vesper Mission is a static React application for encrypted Star Citizen fleet mission delivery. A commander authors a mission locally in the deployed site, exports an encrypted JSON asset, publishes it under `public/missions/`, and sends each member a private decryption link out-of-band.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS v4
- Web Crypto API
- Ed25519 signatures
- AES-256-GCM payload encryption
- PBKDF2-HMAC-SHA256 key wrapping
- Vitest + Testing Library

## Security Model

This project protects mission confidentiality, mission authenticity, and tamper detection for encrypted assets.

- Mission content, including the hero image, is encrypted so unauthorized viewers cannot read field contents.
- AES-256-GCM authentication tags protect field integrity.
- AAD binds schema, mission ID, field name, and cipher parameters to prevent cross-field swapping.
- Wrapped keys and asset metadata are covered by the signed asset structure.
- Ed25519 signatures verify that the mission came from the expected commander key.
- Personal keys use a 16-character Crockford-style base32 format with checksum, backed by PBKDF2 at high iteration count to make offline guessing impractical.

This project does not try to hide membership from someone who already has the asset and a candidate `game_id`, and it does not defend against a compromised hosting platform, compromised GitHub repo, malicious browser extensions, or a compromised commander machine. The modal-based authoring flow also only partially reduces console history leakage; it does not eliminate all local-device risks.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

For a pure type check:

```bash
pnpm typecheck
```

## Commander Workflow

1. Deploy the site.
2. Open the deployed site in the browser.
3. Open DevTools Console.
4. Confirm the `fleetOps` banner is present.
5. Run `fleetOps.help()` if you need the available commands.
6. Run `fleetOps.launchAuthoring()`.
7. Fill in the mission form and generate the mission.
8. Download the generated JSON asset.
9. Drop that JSON file into `public/missions/`.
10. `git push` the repo.
11. Let Cloudflare Pages auto-deploy the update.
12. Send each member their mission link and private key via Discord direct message.

You can inspect the active commander fingerprint with `fleetOps.whoAmI()`.

## Member Workflow

1. Receive the mission link from the commander.
2. Open the link.
3. Enter `game_id` and `private_key`.
4. Decrypt and read the mission.

## Deployment

This project is intended for Cloudflare Pages with GitHub integration.

1. Connect the GitHub repository in Cloudflare Pages.
2. Use the default static build flow with `pnpm install` and `pnpm build`.
3. Publish the `dist/` output directory.
4. Commit mission JSON assets into `public/missions/` and push to GitHub for automatic redeploys.

`wrangler.toml` is included for Pages configuration metadata. You do not need to use the Wrangler CLI for the intended v1 workflow.

## Current Limitation

V1 ships with a placeholder baked-in commander public key in [src/publicKeys/commanderPublicKey.ts](/home/markchou/project/vesper-mission/src/publicKeys/commanderPublicKey.ts). After the first real mission generation, inspect `fleetOps.whoAmI()` and take the returned `publicKeyFingerprint`. Then update `COMMANDER_PUBLIC_KEY_B64URL` in that file with the matching real commander public key and redeploy.

Until that replacement happens, production verification still relies on the placeholder baked-in key path instead of your final commander identity.
