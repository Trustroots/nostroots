# Nostroots Browser

Nostroots Browser has two app tracks:

- `ios/` is the primary native SwiftUI + WKWebView iOS app. Simulator: [`ios/scripts/run-simulator.sh`](ios/scripts/run-simulator.sh).
- `extension/` is the Chromium MV3 NIP-07 browser extension for desktop browsers.

Both tracks are separate from `nr-app`. The native app stores its own key in the iOS Keychain for v1 and loads `https://nos.trustroots.org/` with a native-backed NIP-07 provider.
