# Nostroots iOS

Native SwiftUI + `WKWebView` app for Nostroots iOS.

```bash
ruby scripts/generate_xcodeproj.rb
xcodebuild -project NostrootsBrowser.xcodeproj -scheme NostrootsBrowser -sdk iphonesimulator build
xcodebuild -project NostrootsBrowser.xcodeproj -scheme NostrootsBrowserTests -sdk iphonesimulator test
```

The app loads `https://nos.trustroots.org/` by default, injects a native-backed `window.nostr`, and stores the imported or generated key in this app's private Keychain storage.

When the trusted Radiostr page is active, the app also bridges station metadata
and playback controls into native iOS Now Playing. This supports the universal
CarPlay player and remote play, pause, previous-station, and next-station
controls.

A dedicated app icon and browsable station list on the CarPlay Home screen are
a separate integration. Apple must first grant the app's CarPlay audio
entitlement; after that, the app can add a `CPListTemplate` station browser and
`CPNowPlayingTemplate`.
