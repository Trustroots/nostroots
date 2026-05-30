# Native iOS App Plan

## Summary

Build a new native SwiftUI iOS app for Nostroots, using `nr-web` as the product and behavior source of truth. The app should live under `nr-web/ios-app` and target iOS 17+ for TestFlight first.

This is not a WebView wrapper and not a direct continuation of `nr-app`. The goal is a native iPhone app that preserves the breadth of `nr-web` while borrowing the useful mobile-native product choices already explored in `nr-app`.

V1 should include the core `nr-web` user flows except Pixel:

- Map and Trustroots map notes
- Key generation, manual key import, and backup flow
- Trustroots NIP-05 identity linking
- Relay settings with NIP-42 support
- Note posting, intents, expiration, deletion, and relay-scope warnings
- Chat
- Public profile, self profile, profile editing, contacts, and claims
- Native push notifications
- Local cache/offline-friendly app state

Pixel is explicitly out of scope for v1.

## Key Decisions

- Platform: SwiftUI, iOS-first.
- App home: `nr-web/ios-app`.
- Minimum OS: iOS 17+.
- Release target: TestFlight first.
- Map stack: Apple MapKit, Trustroots-only for v1.
- Nostr stack: Swift Nostr SDK.
- Local cache: SQLite via GRDB.
- Key storage: iOS Keychain.
- Existing web key migration: manual nsec or mnemonic import only.
- Push notifications: APNs in v1, requiring notification schema/daemon work.
- Remote signing/NIP-46: defer for v1.
- Source of truth when behavior differs: `nr-web` wins.

## Why SwiftUI

SwiftUI is the best fit if the product goal is a genuinely native iOS app rather than a fast mobile shell. It gives the app first-class Apple navigation, sheets, permissions, push notifications, Keychain integration, MapKit, accessibility, and App Store expectations.

The tradeoff is that much of the JavaScript UI has to be rebuilt. That is acceptable here because the chosen direction is iOS-first and native, not shared-code parity with Android.

Expo/React Native remains valuable context because `nr-app` already explored several mobile product decisions. Capacitor or WKWebView would be useful only for a quick wrapper prototype, not for the intended app.

## `nr-web` As Source Of Truth

`nr-web` is broader and more current as the product reference. The SwiftUI app should preserve its behavior unless there is a strong native reason to adjust presentation.

Important `nr-web` behavior to carry forward:

- Default relay model: `wss://nip42.trustroots.org`, `wss://relay.trustroots.org`, and `wss://relay.nomadwiki.org`.
- Per-relay read/post controls and relay status.
- NIP-42 auth relay read/write behavior.
- Map note intents.
- NIP-40 expiration, including saved/default expiration preference.
- Own-note deletion through kind 5 deletion events.
- Private key leak guard for nsec content in notes and chat.
- Relay-scope warnings for private/public publishing.
- Chat, including encrypted DMs and circle/channel conversations.
- Public profile routes, self profile, edit profile, and contacts/claims.
- Trustroots claim/contact signing flows.
- Existing tests and fixtures around routing, notes, deletion, expiration, claims, profiles, notifications, and relay publishing.

## Lessons From `nr-app`

`nr-app` is narrower than `nr-web`, but it has useful native-mobile behavior that should influence the SwiftUI app.

Carry forward:

- Welcome screen and first-run onboarding.
- Key setup flow with generate/import options.
- Trustroots NIP-05 linking as part of setup.
- Backup confirmation for generated keys.
- Secure device storage for secrets.
- Native push registration and notification tap handling.
- Native map ergonomics: location button, persisted map region, and bottom sheets.
- Subscribe-after-post prompt for map areas, adapted to APNs.
- System/light/dark appearance preference.
- Developer/debug controls, but hidden from normal users.

Do not carry forward for v1:

- Extra experimental map layers: Hitchmap, Hitchwiki, Time Safari, Trip Hopping, Unverified.
- The prototype NIP-46 connect screen. It appears dev-only and uses a hardcoded mnemonic.
- The simplified single-relay default from `nr-app`.

## Architecture

Create a SwiftUI app with explicit service boundaries:

- `KeyStore`: Keychain-backed key generation, nsec import, mnemonic import, export, backup confirmation, public key derivation, and event signing.
- `RelayPool`: relay configuration, relay status, per-relay read/write flags, NIP-42 auth, reconnects, subscriptions, and publishing acknowledgements.
- `EventStore`: GRDB-backed cache for Nostr events, replaceable event handling, parameterized replaceable event handling, deletion filtering, expiration filtering, and seen-on-relay metadata.
- `MapService`: visible plus-code calculation, Trustroots map note filters, selected area state, and MapKit annotation/overlay projection.
- `ProfileService`: kind 0 metadata, kind 10390 Trustroots profile events, NIP-05 lookup, image safety, profile editing, and claim/profile aggregation.
- `ChatService`: conversation list, encrypted DM/circle messages, message cache, deletion state, search/indexing, and unread state.
- `NotificationService`: APNs registration, encrypted notification subscription event publishing, local notification routing, and notification deep links.
- `SettingsStore`: app preferences, relay settings, appearance, onboarding completion, backup state, and debug flags.

Use Swift models that mirror `nr-common` event schemas and constants. Keep wire compatibility with existing relays and daemons.

## Notifications

`nr-app` currently uses Expo push tokens in kind `10395` notification subscription events. A SwiftUI app should use APNs tokens, so v1 needs backend support.

Implementation direction:

- Keep kind `10395` as the user-owned notification subscription event.
- Extend the encrypted payload to support APNs device tokens while preserving legacy Expo token compatibility.
- Update the notification daemon to deliver APNs notifications.
- Preserve existing subscription filter semantics for plus-code based notifications.
- On notification tap, route into the relevant map area and event detail.

## Native UI Direction

Use native iOS patterns, not web layout translated literally:

- Map is the primary screen.
- Area details open in native sheets.
- Posting uses a native composer sheet.
- Settings use grouped SwiftUI forms.
- Onboarding uses a step-based native flow.
- Profiles and chat use native navigation stacks.
- Relay controls should be clear but not overly technical for normal users.

Map v1 is Trustroots-only. Extra layers can be revisited after the app has stable map, notes, chat, profiles, and notifications.

## Test Plan

Start with spec and protocol tests before broad UI tests.

Port or mirror these `nr-web` test areas into XCTest:

- Hash/route classification as native deep-link routing cases.
- Key parsing and nsec leak detection.
- Note intents.
- Expiration and deletion behavior.
- Claim/contact summary logic.
- Profile field normalization and display projection.
- Notification payload validation.
- Relay publishing success/failure behavior where feasible.
- NIP encryption/signing test vectors supported by the Swift Nostr SDK.

Add XCUITest smoke flows for:

- Onboarding with generated key and backup confirmation.
- Manual nsec/mnemonic import.
- Trustroots identity linking.
- Map load and area selection.
- Note post, note delete, and note expiration display.
- Chat list and message send/read.
- Public profile, self profile, edit profile, and contacts.
- Relay settings.
- APNs registration and notification tap routing.

## Open Follow-Ups

- Confirm the final bundle identifier before TestFlight.
- Choose the exact Swift Nostr SDK version and audit its NIP-42/NIP-44 behavior against Nostroots relays.
- Design the APNs extension to kind `10395` and update the notification daemon.
- Decide how much of `nr-common` should be mirrored manually in Swift versus generated from schemas.
- Define the first TestFlight acceptance checklist.
