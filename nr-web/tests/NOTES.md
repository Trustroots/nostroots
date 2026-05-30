# Testing Notes

## Two-file source model

`nr-web` is shipped as just two source files:

- `index.html` — markup, the entire CSS in one `<style>` block, the classic
  helpers (`NrWeb*` globals + `NrWebHashRouter`), and the Keys / Settings
  modals.
- `index.js` — one ES module containing every Nostroots-authored helper
  (key utils, claim helpers, note intents, nsec-guard, KV-IndexedDB layer,
  NIP-05 resolver, circle metadata, embedded chat, profile page, main map
  glue), exposed via named exports so tests can `import` from it directly.

Third-party assets (`nostr-tools`, `bip39`, `dompurify`, MapLibre, Leaflet,
Google Fonts) stay on their CDNs in production.

## CDN imports under jsdom (Vitest)

`index.js` imports from `https://cdn.jsdelivr.net/npm/...` URLs. jsdom can
not fetch external resources, so `vitest.config.js` rewrites those URLs to
locally installed npm packages via `resolve.alias`:

| jsdelivr URL                                                          | npm package    |
| --------------------------------------------------------------------- | -------------- |
| `https://cdn.jsdelivr.net/npm/nostr-tools@2.23.0/+esm`                | `nostr-tools`  |
| `https://cdn.jsdelivr.net/npm/bip39@3.1.0/+esm`                       | `bip39`        |
| `https://cdn.jsdelivr.net/npm/dompurify@3.2.2/+esm`                   | `dompurify`    |

The matching versions are pinned in `package.json` `devDependencies`. Bump
both the import URL inside `index.js` and the alias + devDep together.

## Strategy

- **Unit tests** import named exports directly from `../../index.js`. They
  exercise pure helpers (`parseKeyImportToHex`, `containsPrivateKeyNsec`,
  claim / circle / note-intent helpers, etc.) and live next to one another
  in `tests/unit/`. The Vitest `setup.js` loads `index.html` into jsdom so
  the inlined classic helpers (`NrWeb*` globals) are available too.
- **Tests that need code from `index.html`'s inline `<script>` blocks**
  (e.g. the `NrWebHashRouter` test, `NrWebTheme` test) extract source
  between marker comments — `NR_HASH_ROUTER_BEGIN/END`,
  `NR_COMMON_JS_BEGIN/END` — and `eval` it in an isolated jsdom window.
  Keep these markers in `index.html` if you reorganise the inlined scripts.
- **Integration tests** drive DOM interactions inside the same jsdom
  fixture.
- **E2E tests** run the real `index.html` in Playwright browsers; this is
  the only place that exercises the full CDN module + map + chat boot.

## Adding a new pure helper

1. Add `export function foo(...)` (or `export const FOO = ...`) somewhere in
   `index.js`.
2. Add `import { foo } from '../../index.js';` to a test file under
   `tests/unit/`.
3. If the helper depends on a CDN package that we do not yet alias for
   tests, add it to the `resolve.alias` table in `vitest.config.js` and as
   a `devDependency` in `package.json`.
