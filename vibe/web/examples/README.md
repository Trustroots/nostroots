# nr-web examples

Pages in this folder are **optional demos** served as static files alongside the main app.

## Rideshares

[`rideshares/`](rideshares/) is a hitchhiker-first journey board for the
Trustroots community. It browses legacy and current kind `30402` rideshare
events, publishes through NIP-07 without collecting private keys, uses broad
public areas instead of exact meeting points, verifies Trustroots NIP-05
identities, lets hitchhikers seek a driver, a co-hitchhiker, or both, and hands
private conversations to Nostroots Web. It uses the shared Nostroots header and
identity-status behavior used by the other Vibe apps.

## Building your own

Nostroots Web is a two-file bundle: [`web/index.html`](../web/index.html) (markup, all CSS, classic helpers, modals) plus [`web/index.js`](../web/index.js) (single ES module with every Nostroots-authored helper). The previous shared `common.js` / `common.css` / `modals-keys-settings.html` files no longer exist as separate sources.

1. Copy the relevant `<style>` and `<script>` blocks out of `web/index.html` into a new HTML file beside it.
2. Pages that want the same chrome can re-use the inlined classic helpers by copy-pasting the blocks between the `NR_COMMON_JS_BEGIN` / `NR_COMMON_JS_END` and `NR_HASH_ROUTER_BEGIN` / `NR_HASH_ROUTER_END` markers in `web/index.html`. The Keys/Settings markup is also inlined there. Override behaviour before those scripts run with:
   - `window.NR_WEB_HEADER_PREFIX = '../'` — logo and nav targets in `fillAppHeader()`.
3. Deploy as static files (GitHub Pages, any CDN). Hash-based routing in `web/index.html` avoids server rewrites; see the main `README.md` section **URL routing (hash)**.

The current app lives at [`web/index.html`](../web/index.html) — map plus codes, chats, keys/settings, and reserved hashes are documented there.
