# Tasks

## 1. Consolidate the hub

- [x] 1.1 Remove the Nostroots Map card and card-specific styling from
  `vibe/web/index.html` without changing the Nostroots Web card or unrelated
  experiments.
- [x] 1.2 Update hub tests so the experimental toggle no longer reveals or
  enumerates Nostroots Map.

## 2. Retire the duplicate runtime

- [x] 2.1 Replace `vibe/web/nostroots-map/index.html` with an accessible static
  redirect to `/web/#map` that uses `location.replace()`, preserves query
  parameters, and provides meta-refresh and link fallbacks.
- [x] 2.2 Delete `vibe/web/nostroots-map/index.js` and remove tests that exercise
  the retired standalone map runtime.
- [x] 2.3 Add focused end-to-end coverage for the redirect, including query
  preservation and the final `#map` route.

## 3. Align documentation and requirements

- [x] 3.1 Update `vibe/web/README.md` so Nostroots Web is the only maintained
  browser map experience and the retired path is documented as compatibility
  behavior.
- [x] 3.2 Update `vibe/web/privacy/index.html` and other user-facing references
  so they no longer describe Nostroots Map as an active separate app.
- [x] 3.3 Search tracked Vibe files for `nostroots-map` and `Nostroots Map`, then
  update remaining active-product references while retaining intentional
  compatibility references.

## 4. Validate

- [x] 4.1 Run focused hub, redirect, and existing `/web/` map browser tests.
- [x] 4.2 Run `make test-fast` from `vibe/web` if the focused checks pass.
- [x] 4.3 Run strict OpenSpec validation for
  `consolidate-nostroots-web-map` from `vibe/`.
- [x] 4.4 Review the final diff and confirm the unrelated existing
  `vibe/web/index.html` Trustroots icon edit remains intact and outside the
  consolidation's logical changes.
