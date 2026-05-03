# nr-web examples

Pages in this folder are **optional demos** served as static files alongside the main app.

## Included

- **pixel.html** — Trustroots Circles pixel toy (self-contained: CSS, relay/NIP-42 helpers, keys/settings markup, and demo logic are inlined in this file). Uses default relays and the same `localStorage` keys as the main map app for keys and relay lists. External assets are limited to Google Fonts and the `nostr-tools` ESM build on jsDelivr.

## Building your own

1. Copy `pixel.html` if you want a single-file demo pattern, or create a new HTML file beside `index.html` and reference `common.css`, `modals.css`, and `common.js` with paths that match your deploy layout.
2. For pages under a subpath that reuse the shared bundle, set before loading `common.js`:
   - `window.NR_WEB_HEADER_PREFIX = '../'` — logo and nav targets in `fillAppHeader()`.
   - `window.NR_WEB_MODALS_PATH = '../modals-keys-settings.html'` — modal fragment fetch in `injectKeysSettingsModals()`.
3. Deploy as static files (GitHub Pages, any CDN). Hash-based routing in `index.html` avoids server rewrites; see the main `README.md` section **URL routing (hash)**.

The main app remains [`index.html`](../index.html) — map plus codes, chats, keys/settings, and reserved hashes are documented there.
