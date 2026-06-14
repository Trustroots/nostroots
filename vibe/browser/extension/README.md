# Nostroots Extension

MV3 NIP-07 signer for Nostroots and compatible Nostr web apps. Chrome, Brave, Edge, and Firefox desktop builds are generated from the same source.

This package is intentionally standalone, like `vibe/browser/expo`, and is not part of the root pnpm workspace.

```bash
cd vibe/browser/extension
pnpm install
pnpm build
pnpm dev
pnpm test
pnpm lint
```

`pnpm build` creates:

- `dist/chrome/` for Chrome, Brave, and Edge.
- `dist/firefox/` for Firefox desktop.

## Local development

For day-to-day development in Chrome, Brave, or Edge:

1. Run `pnpm dev`.
2. Open `brave://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select `vibe/browser/extension/dist/chrome`.
5. After code changes, the watcher rebuilds `dist/chrome`; click the extension reload button in `brave://extensions`.

For Firefox desktop:

1. Run `pnpm dev:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on...**.
4. Select `vibe/browser/extension/dist/firefox/manifest.json`.
5. After code changes, remove and reload the temporary add-on.

## Builds and packages

```bash
pnpm build:chrome
pnpm build:firefox
pnpm lint:firefox
pnpm package:chrome
pnpm package:firefox
```

Package outputs are written to `vibe/browser/extension/packages/`:

- `nostroots-extension-chrome-<version>.zip` is ready for Chrome Web Store upload.
- `nostroots-extension-firefox-<version>.zip` is ready for Firefox AMO upload.

Firefox AMO source note: the submitted add-on is bundled from TypeScript with esbuild. Reviewers can reproduce it with `pnpm install && pnpm package:firefox`; the Firefox manifest is generated into `dist/firefox/manifest.json` with the Gecko ID `nostroots-extension@trustroots.org`.

## Reviewer notes

- Purpose: provide a small NIP-07 signer so Nostroots and compatible Nostr web apps can call `window.nostr`.
- Private key: one private key is stored locally in extension storage. It is never sent to Trustroots or a relay by the extension.
- Page access: the content script injects `provider.js` on HTTPS pages and local development origins so compatible web apps can detect `window.nostr`.
- Permissions: `storage` keeps the local key and remembered site approvals; `windows` opens the per-site signing prompt; relay host permissions support Trustroots identity lookup and relay sign-in flows.
- User consent: Trustroots domains are allowed automatically; other HTTPS and local development origins prompt for `Allow once`, `Always allow`, or `Deny`.

## V1 behavior

- One stored key/profile only.
- Import `nsec`, 64-character private-key hex, or a NIP-06 recovery phrase.
- Generate a new key and recovery phrase.
- Replacing or removing the key clears remembered site approvals.
- Trustroots domains are allowed automatically.
- Other HTTPS and local development origins prompt for `Allow once`, `Always allow`, or `Deny`.
- Exposes `window.nostr.getPublicKey`, `signEvent`, `nip44`, and `nip04`.

The key is stored directly in extension local storage, following the nos2x-simple model. There is no passphrase lock in v1.
