# Chrome Web Store listing assets

Generated with:

```bash
cd vibe/browser/extension
node scripts/create-store-assets.mjs
```

Upload these in the Chrome Web Store Developer Dashboard:

- `small-promo-440x280.png`
- `marquee-promo-1400x560.png` (optional but ready)
- `screenshot-settings-1280x800.png`

The packaged extension ZIP includes the generated manifest icons from `src/ui/icons/`.

Suggested short description:

Small NIP-07 signer for Nostroots and compatible Nostr web apps.

Suggested description:

Nostroots Extension is a small NIP-07 signer for Nostroots and compatible Nostr web apps.

It lets websites request your Nostr public key and ask you to sign events through the standard `window.nostr` browser API. Your private key stays in local extension storage and is never shared with Nostroots, websites, or relays.

Use it to:

- Sign in to Nostroots with a Nostr key.
- Use compatible Nostr web apps that support NIP-07 browser signers.
- Import an existing Nostr private key, nsec, or recovery phrase.
- Generate a new key and recovery phrase.
- Review site access before non-Trustroots sites can sign with your key.

Trustroots domains are allowed automatically so Nostroots works smoothly. Other HTTPS and local development sites ask before signing, with options to allow once, always allow, or deny.

Nostroots Extension is intentionally simple: one local key, clear site access, and no remote key sync.

Suggested privacy policy URL:

https://nos.trustroots.org/privacy/
