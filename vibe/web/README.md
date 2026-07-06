# Nostroots Web

Static web workspace for Nostroots browser experiences.

**Live version:** [https://nos.trustroots.org/](https://nos.trustroots.org/)

The root page is a small hub. It links to classic Trustroots network settings, Nostroots Web, mobile app downloads, and background information by default, with experimental apps behind a toggle.

## Experiences

- [`/background/`](background/) — background, vision, and FAQ for Nostroots and the Trustroots/Nostr direction.
- [`https://www.trustroots.org/profile/edit/networks`](https://www.trustroots.org/profile/edit/networks) — classic Trustroots network editing.
- [`/web/`](web/) — Nostroots Web, the current map/chat/profile app for Trustroots-style activity with light Nostr key support.
- [`/nostrail/`](nostrail/) — experimental foreground-only encrypted approximate-location sharing for Nostroots Browser.
- [`/nostroots-map/`](nostroots-map/) — experimental browser-native map prototype inspired by the mobile `nr-app`, built without React or Expo Web.
- [`/examples/squatbridge.html`](examples/squatbridge.html) — experimental bridge from [radar.squat.net](https://radar.squat.net) events to Nostr; hidden on the hub until you enable experimental apps.
- [`https://www.letsmiti.app/`](https://www.letsmiti.app/) — external Let's Miti app, hidden on the hub until you enable experimental apps.
- [`https://treasures.to/`](https://treasures.to/) — external Treasures web app, hidden on the hub until you enable experimental apps.
- [`/examples/`](examples/) — optional demos and fork patterns.

Legacy root hash/query links still land in the current app. For example, `/#stats` redirects to `/web/#stats`, and `/?welcome=1` redirects to `/web/?welcome=1`. The previous `/v0/` app path redirects to `/web/` for old shared links.

## Features

- **Nostroots Web**: View traveler notes, post by plus code with a Trustroots identity, manage keys, use NIP-07, chat, browse profiles, and configure relays.
- **Nostrail**: Share a temporary approximate area with selected people using the browser-provided NIP-07 signer, NIP-44 encryption, NIP-42 relay auth, and foreground-only updates.
- **Nostroots Map**: Map-first browser-native prototype with NIP-07 signer detection.
- **Let's Miti**: External experimental web app linked from the hub.
- **Treasures**: External web app linked from the experimental hub.
- **Pixel**: Circle-scoped pixel sequencer (artists, burners, punks) — draw a 16×16, publish to Nostr, optional "Where" and invite/jam for IRL meetups. [examples/pixel.html](examples/pixel.html)
- **Examples hub**: [examples/index.html](examples/index.html) — overview of demo pages and fork patterns.

## URL routing (hash)

Nostroots Web (`web/index.html`) uses **`location.hash`** only (no path router; static hosting friendly). The parser lives inside `web/index.html` (look for the `NR_HASH_ROUTER_BEGIN` / `NR_HASH_ROUTER_END` markers) and is exposed as `window.NrWebHashRouter`.

| Fragment | Meaning |
|----------|---------|
| *(empty)* | Map home |
| `keys` / `settings` | Keys or Settings modal |
| `stats` | Progress stats dashboard |
| `map`, `chat`, `help`, `welcome`, `start` | Reserved actions (e.g. `#chat` opens chats with empty picker; `#map` clears hash and returns to map) |
| Contains `+` as a full Open Location Code (prefix may end with `+` and no refinement, e.g. `9G000000+`) | Map — notes for that plus code |
| `profile` | **My profile** — always opens your own profile in editable mode (prompts for key if not loaded) |
| `profile/npub1…`, `profile/<64-char-hex>`, or `profile/<NIP-05>` (NIP-05 may be URL-encoded, e.g. `profile/alice%40trustroots.org`) | **Profile** — public Nostr-backed profile view (invalid remainder shows an error in the profile shell) |
| Same as above with suffix `/edit` or `/contacts` (case-insensitive) | **Edit profile** (kind 0 metadata, signed-in user only) or **Contacts** (Trustroots claim / relationships / experiences panel moved from Keys; self only for signing) |
| `npub1…` or 64-char hex | Chat — DM |
| Looks like NIP-05 (e.g. `alice%40trustroots.org`) | Chat — DM |
| Otherwise | Chat — circle / channel slug |

Circle slugs cannot match reserved words (`welcome`, `start`, etc.); see `NrWebHashRouter.EXTENDED_RESERVED` inside the `NR_HASH_ROUTER_BEGIN` block in `web/index.html`.

Query shortcuts (stripped after load): `?action=map|host|search`, `?welcome=1`, `?start=1` (see `processNrWebUrlAction()` in `web/index.html`).

## Getting Started

Nostroots Web is shipped as **two source files**:

- [`web/index.html`](web/index.html) — markup, all CSS in a single `<style>` block, the classic-script helpers (`NrWeb*` globals + `NrWebHashRouter`), the inlined Keys/Settings modals, and a `<script type="module" src="./index.js">` that loads the rest.
- [`web/index.js`](web/index.js) — a single ES module containing every Nostroots-authored helper (key utils, claim/note-intents helpers, nsec-guard, KV-IndexedDB layer, NIP-05 resolver, circle metadata, embedded chat, profile page, and the main map glue), exported by name so unit tests can import directly.

The root [`index.js`](index.js) re-exports Nostroots Web helpers for test/backward compatibility.

Third-party assets (`maplibre-gl`, `leaflet`, `nostr-tools`, `bip39`, `dompurify`, Google Fonts) stay on their respective CDNs. There is no build step: serve the folder from any static host.

When iterating locally, run `./dev.sh` and open the printed URL. Refresh after editing — there is no bundler cache.



## Development Notes

### Style guide

Use [`../docs/STYLE_GUIDE.md`](../docs/STYLE_GUIDE.md) for `nr-web` copy tone and lightweight visual guidance, especially for first-impression and onboarding changes.

### Relay scope (globe / lock UI)

See [`../docs/RELAY_SCOPE_UI.md`](../docs/RELAY_SCOPE_UI.md) for how `relayScope` is set on map notes and chat, why subscription-only events often have no globe/lock pill, and safe options if we extend this later.

### Trustroots validation and relays

See [`../docs/TRUSTROOTS_MAP_NOTES.md`](../docs/TRUSTROOTS_MAP_NOTES.md) for the dual map-note trust model in this repo: `30397 -> nr-server -> 30398` and the nr-web auth-relay path (`wss://nip42.trustroots.org` + NIP-42) where `30397` is treated as Trustroots-scoped in product behavior.

### Testing

The repo still iterates quickly on `nr-web`: tests exist to guard important behavior, not to drive every small UI change. Prefer meaningful coverage over a large suite; run the stack when you are changing critical paths or preparing to merge.

Tests are designed to run in Docker by default for consistency and safety. See [tests/README.md](tests/README.md) for details.

**Quick test commands:**
```bash
make test-fast     # Fast: Vitest + Playwright Chromium only (default for quick feedback)
make test          # Full: Vitest + every Playwright project (CI-parity, slower)
make test-watch    # Watch mode
make test-e2e      # E2E tests only (all projects)
make test-e2e-fast # E2E Chromium only
```

**NIP-42 (`wss://nip42.trustroots.org`):** Automated tests mostly use public relays. For AUTH challenge/response behavior, use the manual client in [`test.html`](test.html). NIP-42 read/publish paths are not fully covered in CI.

### Manual image verification (imported Trustroots data)

When validating importer output and route rendering together:

1. Open [`test.html`](test.html) and run **Image tests** for expected Trustroots URLs.
2. Open profile route:
   - `#profile/nostroots%40trustroots.org`
   - confirm the avatar is loaded from `uploads-profile` (or expected fallback).
3. Open circle route:
   - `#hitchhikers`
   - confirm circle metadata image (from importer `30410` `content.picture`) is visible where circle image chrome is shown (chat/sidebar/thread header).

If image tests pass in `test.html` but a route does not show the image, check importer event shape first (`30390`/`30410`) and then the client metadata wiring inside `web/index.js` — the chat, profile, and circle-metadata code is all folded into that single module.

### Real Apple iOS Simulator (Xcode) automation

Use this when you want real Safari automation on an Apple iOS Simulator, without running npm/pnpm on host:

- Host requirements: Xcode + Simulator, Appium CLI (`appium`), Docker, Python 3
- Host does **not** run npm/pnpm commands in this flow
- Docker runs the WebDriver smoke client

Run:

```bash
./scripts/test-ios-simulator-real.sh
```

Optional device override:

```bash
IOS_SIMULATOR_DEVICE="iPhone 17 Pro Max" ./scripts/test-ios-simulator-real.sh
```

If Appium reports missing XCUITest driver, run once on host:

```bash
APPIUM_HOME="$HOME/.appium" appium driver install xcuitest
```

Notes:
- This path uses Appium + XCUITest against real iOS Simulator Safari.
- It is separate from Playwright `ios-safari`, which is WebKit emulation.

### Real Android Emulator automation

Use this when you want real Chrome automation on an Android Emulator, without running npm/pnpm on host:

- Host requirements: Android SDK emulator + AVD, Appium CLI (`appium`), Docker, Python 3
- Host does **not** run npm/pnpm commands in this flow
- Docker runs the WebDriver smoke client

Run:

```bash
./scripts/test-android-emulator-real.sh
```

Optional AVD override:

```bash
ANDROID_AVD_NAME="Medium_Phone_API_35" ./scripts/test-android-emulator-real.sh
```

### Committing Changes

The repository has pre-commit hooks that run ESLint on the `nr-app` folder. Since `nr-web` is a standalone HTML file and doesn't use the same tooling, you should skip the pre-commit hook when committing changes that only affect `nr-web`:

```bash
git commit --no-verify -m "Your commit message"
```
