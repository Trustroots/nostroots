# nr-web examples

Pages in this folder are **optional demos** served as static files alongside the main app.

## Included

- **pixel.html** — Trustroots Circles pixel toy (self-contained: CSS, relay/NIP-42 helpers, keys/settings markup, and demo logic are inlined in this file). Uses default relays and the same `localStorage` keys as the main map app for keys and relay lists. External assets are limited to Google Fonts and the `nostr-tools` ESM build on jsDelivr.

## Building your own

The main app is now a two-file bundle: [`index.html`](../index.html) (markup, all CSS, classic helpers, modals) plus [`index.js`](../index.js) (single ES module with every Nostroots-authored helper). The previous shared `common.js` / `common.css` / `modals-keys-settings.html` files no longer exist as separate sources.

1. Copy `pixel.html` if you want a single-file demo pattern, or copy the relevant `<style>` and `<script>` blocks out of `index.html` into a new HTML file beside it.
2. Pages that want the same chrome can re-use the inlined classic helpers by copy-pasting the blocks between the `NR_COMMON_JS_BEGIN` / `NR_COMMON_JS_END` and `NR_HASH_ROUTER_BEGIN` / `NR_HASH_ROUTER_END` markers in `index.html`. The Keys/Settings markup is also inlined there. Override behaviour before those scripts run with:
   - `window.NR_WEB_HEADER_PREFIX = '../'` — logo and nav targets in `fillAppHeader()`.
3. Deploy as static files (GitHub Pages, any CDN). Hash-based routing in `index.html` avoids server rewrites; see the main `README.md` section **URL routing (hash)**.

The main app remains [`index.html`](../index.html) — map plus codes, chats, keys/settings, and reserved hashes are documented there.
