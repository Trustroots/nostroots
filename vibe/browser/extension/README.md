# Nostroots Browser Extension

Chromium MV3 NIP-07 signer for Nostroots and compatible Nostr web apps.

This package is intentionally standalone, like `vibe/browser/expo`, and is not part of the root pnpm workspace.

```bash
cd vibe/browser/extension
pnpm install
pnpm build
pnpm dev
pnpm test
pnpm lint
```

Load `dist/` as an unpacked extension in Chrome, Brave, or Edge.

For day-to-day development in Brave:

1. Run `pnpm dev`.
2. Open `brave://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select `vibe/browser/extension/dist`.
5. After code changes, the watcher rebuilds `dist`; click the extension reload button in `brave://extensions`.

## V1 behavior

- One stored key/profile only.
- Import `nsec`, 64-character private-key hex, or a NIP-06 recovery phrase.
- Generate a new key and recovery phrase.
- Replacing or removing the key clears remembered site approvals.
- Trustroots domains are allowed automatically.
- Other HTTPS and local development origins prompt for `Allow once`, `Always allow`, or `Deny`.
- Exposes `window.nostr.getPublicKey`, `signEvent`, `nip44`, and `nip04`.

The key is stored directly in `chrome.storage.local`, following the nos2x-simple model. There is no passphrase lock in v1.
