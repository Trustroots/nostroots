# Nostroots Browser

Nostroots Browser has two app tracks:

- `expo/` keeps the original Expo WebView prototype.
- `ios/` is the primary native SwiftUI + WKWebView iOS app.

Both apps are separate from `nr-app`. The native app stores its own key in the iOS Keychain for v1 and loads `https://nos.trustroots.org/` with a native-backed NIP-07 provider.
