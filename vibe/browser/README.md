# Nostroots Browser

Nostroots Browser has two app tracks:

- `expo/` keeps the original Expo WebView prototype (likely deprecated; see [`expo/README.md`](expo/README.md)). Kept until a native Android app exists. Simulator: [`scripts/run-expo-simulator.sh`](scripts/run-expo-simulator.sh).
- `ios/` is the primary native SwiftUI + WKWebView iOS app. Simulator: [`ios/scripts/run-simulator.sh`](ios/scripts/run-simulator.sh).

Both apps are separate from `nr-app`. The native app stores its own key in the iOS Keychain for v1 and loads `https://nos.trustroots.org/` with a native-backed NIP-07 provider.
