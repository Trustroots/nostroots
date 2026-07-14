# Nostroots iOS

Native SwiftUI + `WKWebView` app for Nostroots iOS.

```bash
ruby scripts/generate_xcodeproj.rb
xcodebuild -project NostrootsBrowser.xcodeproj -scheme NostrootsBrowser -sdk iphonesimulator build
xcodebuild -project NostrootsBrowser.xcodeproj -scheme NostrootsBrowserTests -sdk iphonesimulator test
```

The app loads `https://nos.trustroots.org/` by default, injects a native-backed `window.nostr`, and stores the imported or generated key in this app's private Keychain storage.
