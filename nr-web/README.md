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
- **Pixel**: Circle-scoped pixel sequencer (artists, burners, punks) — draw a 16×16, publish to Nostr, optional "Where" and invite/jam for IRL meetups. [pixel.html](pixel.html)


## Getting Started

It's just one file with HTML, CSS and JS.



## Development Notes

### Style guide

Use [`STYLE_GUIDE.md`](STYLE_GUIDE.md) for `nr-web` copy tone and lightweight visual guidance, especially for first-impression and onboarding changes.

### Testing

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
