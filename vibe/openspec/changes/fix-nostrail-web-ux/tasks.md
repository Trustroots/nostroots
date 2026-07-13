## 1. Transfer and Baseline

- [x] 1.1 Copy `openspec/changes/fix-nostrail-web-ux/` from `hitchwiki-private` to `nostroots/vibe/openspec/changes/fix-nostrail-web-ux/`, preserving the directory structure.
- [x] 1.2 From `nostroots/vibe/`, run `openspec status --change fix-nostrail-web-ux` and `openspec validate fix-nostrail-web-ux --strict`; resolve any capability-path differences before code changes.
- [x] 1.3 Inspect the Nostroots worktree and preserve unrelated modifications, especially any existing edits to `vibe/web/index.html`.
- [x] 1.4 Run the existing Nostrail unit and Chromium E2E coverage to record the baseline behavior before implementation.

## 2. Shared Header and Identity Presentation

- [x] 2.1 Replace Nostrail's bespoke top bar with the shared Nostroots header structure and `site-chrome.css` styling, including logo, app links, responsive behavior, and an accessible identity-status area.
- [x] 2.2 Integrate shared identity lookup/presentation without creating a second conflicting signer authority; keep Nostrail's full NIP-07/NIP-44 capability state authoritative for action availability.
- [x] 2.3 Add or reuse hexadecimal-to-`npub` formatting so signer, recipient, and peer fallbacks never render full or shortened hexadecimal public keys.
- [x] 2.4 Audit visible text, tooltips, titles, ARIA labels, recipient rows, received-location rows, and status pills to ensure no hexadecimal public key is presented.

## 3. Interactive Approximate-Location Map

- [x] 3.1 Add the Leaflet/OpenStreetMap assets and initialization pattern already used by `vibe/web/nostroots-map/`, with mouse, touch, keyboard, wheel/pinch zoom, and visible zoom controls enabled.
- [x] 3.2 Isolate map operations behind a small adapter that can initialize, report failure, set or update own/peer approximate-area layers, remove expired/stopped layers, and explicitly recenter.
- [x] 3.3 Replace CSS/hash-positioned own and peer markers with coordinate-based layers using `centerLat`, `centerLon`, and `accuracyM`, visually representing an approximate area rather than an exact point.
- [x] 3.4 Track explicit recentering separately from user movement so ordinary renders and incoming events do not reset a viewport the user has panned or zoomed.
- [x] 3.5 Keep recipient and sharing controls usable when map assets fail, and show a non-blocking map-unavailable state.

## 4. Location Consent and Map Copy

- [x] 4.1 Add an initial soft prompt explaining that approximate location can center the map and support sharing, with “Use My Location” and “Not Now” actions.
- [x] 4.2 Ensure page initialization and “Not Now” do not invoke browser geolocation; invoke it only after the affirmative action, and keep invite/start-sharing disabled until location succeeds.
- [x] 4.3 On successful location, compute the existing approximate Plus Code area, update the own-area layer, and center only for the accepted initial request or an explicit recenter action.
- [x] 4.4 Provide clear retry behavior for denied, unavailable, or timed-out geolocation while leaving the map and recipient controls usable.
- [x] 4.5 Remove the “Choose people, then share your approximate area.” overlay, its CSS, and all render-time updates; keep next steps and errors in the control panel or recipient sheet.

## 5. Reliable Add People Flow

- [x] 5.1 Preserve the current accepted recipient formats: Trustroots username, `@username`, Trustroots profile URL, NIP-05 handle, npub, and 64-character hexadecimal public-key input.
- [x] 5.2 Refactor recipient submission into explicit pending, resolved, duplicate, and failed states; disable duplicate in-flight submission and show lookup progress before reporting success.
- [x] 5.3 Add a bounded NIP-05 lookup timeout and distinguish invalid input, network/HTTP failure, timeout, malformed response, and missing valid key with actionable row-level feedback.
- [x] 5.4 Retain failed values for edit or retry, support mixed-success batches, and ensure only resolved unique recipients enable invite or sharing actions.
- [x] 5.5 Canonicalize recipients after resolution so aliases resolving to the same public key produce one row and a duplicate explanation.
- [x] 5.6 Render resolved friendly identity/original labels, falling back to shortened `npub`, and never redisplay hexadecimal input after submission.
- [x] 5.7 Verify remove, edit, retry, sheet close/reopen, sharing start, location update, and stop-sharing flows continue to use the correct canonical recipients.

## 6. Automated Verification

- [x] 6.1 Extend Nostrail unit tests for hexadecimal-to-`npub` presentation, recipient state transitions, lookup timeout/error classification, post-resolution deduplication, and mixed batches.
- [x] 6.2 Extend Nostrail Playwright coverage for the shared responsive header, absence of visible hex keys, soft location consent before geolocation, accept/decline/retry states, and map initialization failure fallback.
- [x] 6.3 Add browser tests proving map pan/zoom changes persist across application renders and own/peer approximate areas use payload coordinates and disappear on stop or expiry.
- [x] 6.4 Add browser tests for successful, duplicate, invalid, failed, timed-out, editable/retryable, and mixed recipient additions using deterministic mocks.
- [x] 6.5 Run the focused unit test file and Chromium Nostrail E2E spec, then run `make test-fast` from `vibe/web/` when the scoped checks pass.

## 7. Manual Verification and Handoff

- [ ] 7.1 Smoke-test `/nostrail/` at narrow mobile and desktop widths with a real signer, confirming shared header parity and no visible hexadecimal keys.
- [ ] 7.2 Smoke-test mouse/touch movement, zoom controls, accepted location centering, later manual browsing, and location declined/unavailable behavior.
- [ ] 7.3 Smoke-test a real Trustroots username against the live NIP-05 endpoint and verify success, duplicate, unknown-user, and retry behavior without relying on live services in CI.
- [ ] 7.4 Re-run `openspec validate fix-nostrail-web-ux --strict` from `nostroots/vibe/` and confirm every task is complete before requesting archive.
- [x] 7.5 Document deployment verification as read-only checks and rollback as reverting the static Nostrail/spec commits; do not add control-plane environment or infrastructure changes.
