# Nostroots Web App

A vibed web application that replicates the functionality of the nostroots mobile app, providing a map-based interface for sharing notes on the Nostr network.

**Live version:** [https://nos.trustroots.org/](https://nos.trustroots.org/)

It's not a replacement for the app, it's a way to quickly try different things without going through the lengthy process of building and releasing a new version of the app.

This web app provides similar functionality to the `nr-app` mobile app:
- Uses the same (default) relays
- Uses the same event formats (via `@trustroots/nr-common`)
- Compatible key formats


## Features

- **Interactive Map**: View nostroots notes displayed on a Leaflet-based map
- **Note Posting**: Add notes to any pluscode location by clicking on the map
- **Key Management**: Generate new keys or import existing ones (nsec or mnemonic)
- **Persistent Settings**: Preferences and keys are stored locally
- **Pixel**: Circle-scoped pixel sequencer (artists, burners, punks) — draw a 16×16, publish to Nostr, optional "Where" and invite/jam for IRL meetups. [examples/pixel.html](examples/pixel.html)
- **Examples hub**: [examples/index.html](examples/index.html) — overview of demo pages and fork patterns.

## URL routing (hash)

The main app (`index.html`) uses **`location.hash`** only (no path router; static hosting friendly). Parser order is implemented in [`nr-hash-router.js`](nr-hash-router.js) and wired in `index.html`.

| Fragment | Meaning |
|----------|---------|
| *(empty)* | Map home |
| `keys` / `settings` | Keys or Settings modal |
| `map`, `chat`, `help`, `welcome`, `start` | Reserved actions (e.g. `#chat` opens chats with empty picker; `#map` clears hash and returns to map) |
| Contains `+` as a full Open Location Code (prefix may end with `+` and no refinement, e.g. `9G000000+`) | Map — notes for that plus code |
| `profile` | **My profile** — always opens your own profile in editable mode (prompts for key if not loaded) |
| `profile/npub1…`, `profile/<64-char-hex>`, or `profile/<NIP-05>` (NIP-05 may be URL-encoded, e.g. `profile/alice%40trustroots.org`) | **Profile** — public Nostr-backed profile view (invalid remainder shows an error in the profile shell) |
| Same as above with suffix `/edit` or `/contacts` (case-insensitive) | **Edit profile** (kind 0 metadata, signed-in user only) or **Contacts** (Trustroots claim / relationships / experiences panel moved from Keys; self only for signing) |
| `npub1…` or 64-char hex | Chat — DM |
| Looks like NIP-05 (e.g. `alice%40trustroots.org`) | Chat — DM |
| Otherwise | Chat — circle / channel slug |

Circle slugs cannot match reserved words (`welcome`, `start`, etc.); see `NrWebHashRouter.EXTENDED_RESERVED` in `nr-hash-router.js`.

Query shortcuts (stripped after load): `?action=map|host|search`, `?welcome=1`, `?start=1` (see `processNrWebUrlAction()` in `index.html`).

## Getting Started

Core UI is `index.html` with small helpers: `common.js`, `nr-hash-router.js`, `chat-app.js` (embedded chat), plus shared CSS fragments.



## Development Notes

### Style guide

Use [`STYLE_GUIDE.md`](STYLE_GUIDE.md) for `nr-web` copy tone and lightweight visual guidance, especially for first-impression and onboarding changes.

### Relay scope (globe / lock UI)

See [`RELAY_SCOPE_UI.md`](RELAY_SCOPE_UI.md) for how `relayScope` is set on map notes and chat, why subscription-only events often have no 🌍/🔐 pill, and safe options if we extend this later.

### Trustroots validation and relays

See [`docs/TRUSTROOTS_MAP_NOTES.md`](docs/TRUSTROOTS_MAP_NOTES.md) for the dual map-note trust model in this repo: `30397 -> nr-server -> 30398` and the nr-web auth-relay path (`wss://nip42.trustroots.org` + NIP-42) where `30397` is treated as Trustroots-scoped in product behavior.

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

If image tests pass in `test.html` but a route does not show the image, check importer event shape first (`30390`/`30410`) and then client metadata wiring (`nr-profile-page.js`, `chat-app.js`, `circle-metadata.js`).

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
