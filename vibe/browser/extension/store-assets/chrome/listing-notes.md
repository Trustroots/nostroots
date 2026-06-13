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

Privacy practices tab:

Single purpose:

Nostroots Extension provides a NIP-07 browser signer for Nostroots and compatible Nostr web apps. It lets sites request the user's public Nostr key and ask the extension to sign Nostr events without exposing the user's private key to the site.

Host permission justification:

The extension injects a NIP-07 `window.nostr` provider on HTTPS pages so Nostroots and compatible Nostr web apps can detect the signer and request signatures. It also supports localhost origins for development. Non-Trustroots sites must ask for user approval before signing. The Trustroots relay WebSocket host permissions support identity lookup and NIP-42 relay sign-in flows.

Storage permission justification:

The extension uses local extension storage to save the user's Nostr private key and remembered site access choices. This allows the user to keep signing in and signing events locally without sending the private key to Nostroots, websites, or relays.

Remote code use justification:

The extension does not execute remotely hosted code. All JavaScript used by the extension is bundled in the submitted package. Network connections are used for Trustroots/Nostr relay communication, not for loading executable code.

Data usage certification:

The extension stores the user's Nostr private key locally in Chrome extension storage and uses it only to sign Nostr events when requested by approved sites. The private key is not sold, transferred, or used for unrelated purposes.

Publisher contact email:

Use a monitored Trustroots email address, then verify it from the Chrome Web Store settings page before publishing.
