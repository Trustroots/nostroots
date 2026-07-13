## Why

The Nostrail web experiment does not yet behave like the other Nostroots web apps: it exposes a shortened hexadecimal public key, uses a decorative map that cannot be moved or zoomed, and provides a recipient flow that appears unreliable outside mocked tests. The first-use experience should make location permission understandable while keeping the map and recipient controls useful when permission or lookup fails.

## What Changes

- Align the Nostrail header with the shared Nostroots web chrome and remove hexadecimal public keys from every visible state.
- Replace the decorative map with the existing Nostroots interactive map pattern, including mouse/touch movement, zoom controls, and coordinate-based approximate-area markers.
- Add an initial soft location prompt that explains why location is useful, invokes browser geolocation only after explicit user action, and keeps invite/sharing actions disabled until a location fix succeeds.
- Remove the map overlay text “Choose people, then share your approximate area.” and keep operational feedback in the control panel.
- Make the existing recipient input reliably resolve Trustroots usernames, profile URLs, NIP-05 handles, npubs, and hexadecimal public-key input, while showing progress, actionable failures, deduplication, friendly non-hex labels, and Trustroots profile links.
- Add focused automated coverage and desktop/mobile smoke checks for the revised behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vibe-web`: Strengthen the Nostrail web experiment requirements for shared header chrome, key-safe identity presentation, interactive mapping, consent-based location access, and reliable recipient selection.

## Impact

- **Owning sibling repository:** `/Users/k/code/trustroots/nostroots`
- **Planning destination:** `vibe/openspec/changes/fix-nostrail-web-ux/`
- **Primary implementation:** `vibe/web/nostrail/index.html` and `vibe/web/nostrail/index.js`
- **Shared UI/map references:** `vibe/web/site-chrome.css`, `vibe/web/site-chrome-identity.js`, and `vibe/web/nostroots-map/`
- **Tests:** `vibe/web/tests/unit/nostrail.test.js` and `vibe/web/tests/e2e/nostrail.spec.js`
- **Dependencies:** reuse the map libraries and assets already shipped by Vibe Web; avoid adding a new map stack solely for Nostrail
- **Environment and production:** no new environment variables, control-plane services, wiki behavior, or production mutations are required. Rollback is a static web revert of the Nostrail and spec commits; deployment verification is a read-only browser smoke test.
