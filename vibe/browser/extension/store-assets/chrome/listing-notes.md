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

Suggested privacy policy URL:

https://nos.trustroots.org/privacy/
