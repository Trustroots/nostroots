# Nostrail: KISS Native iOS Plan

## Summary

Build `Nostrail`, a tiny native Swift iOS app for temporary encrypted location sharing between Trustroots-verified Nostr users.

Reviewed decisions now locked:

- Platform: native Swift/SwiftUI, not Expo.
- Identity: reuse existing Trustroots NIP-05 assumptions and `nip42.trustroots.org` relay gate.
- Delivery: temporary stored encrypted events, not live-only ephemeral events.
- Precision: approximate location by default.
- Background: limited background sharing only during an explicit active session.
- Protocol: repo-compatible signed encrypted events on the NIP-42 relay, not NIP-17 gift wraps in v1.

## Key Changes

- Create a small iOS app separate from the broad `nr-web/docs/iOS-plan.md`; do not port `nr-web`.
- Use SwiftUI, MapKit, CoreLocation, Keychain, URLSession/WebSocket, and a minimal Nostr layer.
- Use one relay in v1: `wss://nip42.trustroots.org`.
- Import only existing keys: `nsec` and private-key hex. No key generation or backup flow in v1.
- Resolve users by `name@trustroots.org`, following the repo's existing NIP-05 behavior.
- Out of scope: public map notes, profiles UI, chat UI, APNs, relay settings, map layers, full event cache.

## Protocol And Privacy

- Publish a custom regular Nostr event kind for Nostrail location payloads, with `p` tags for recipients, signed by the authenticated user, and encrypted content using NIP-44-style payload encryption.
- Include an `expiration` tag on every location event; clients must ignore expired events even if a relay still returns them.
- Use approximate location by snapping to an area, not exact coordinates. Default target precision: roughly neighborhood/block scale, around 250-500m.
- Payloads:

  ```json
  { "type": "trustroots.location.v1", "sessionId": "...", "area": "...", "centerLat": 52.52, "centerLon": 13.405, "accuracyM": 500, "createdAt": 1760000000, "expiresAt": 1760003600 }
  ```

  ```json
  { "type": "trustroots.location.invite.v1", "message": "", "createdAt": 1760000000 }
  ```

  ```json
  { "type": "trustroots.location.stop.v1", "sessionId": "...", "createdAt": 1760000000 }
  ```

- Do not use ephemeral event kinds in v1; they are too easy to miss when iOS apps are offline or suspended.

## App Behavior

- Onboarding: import key, derive pubkey, store secret in Keychain, authenticate to `nip42.trustroots.org`.
- Map: show the user's approximate current area and fresh shared locations from accepted users.
- Sharing session: default duration 2 hours, manually stoppable, with temporary events expiring shortly after each update.
- Updates: send every 5 minutes while active, and in limited background mode only after the user explicitly enables sharing.
- Background sharing: request the needed iOS location permission only when starting an active session; show clear in-app state and stop automatically when the session expires.
- Invites: enter `name@trustroots.org`, resolve pubkey, send encrypted invite; recipient can accept, ignore, or stop sharing.

## Implementation Notes

- Use a pinned Swift Package Manager dependency for secp256k1/Schnorr/ECDH, with `P256K` / `swift-secp256k1` as the first candidate.
- Implement the minimal Nostr pieces needed: NIP-01 event signing, NIP-05 lookup, NIP-19 key parsing, NIP-42 auth event, NIP-44 encryption/decryption, relay publish/subscribe.
- Verify NIP-44 against official test vectors before using it for location payloads.
- Keep persistence small: Keychain for secret key, UserDefaults or SQLite for contacts, accepted sessions, and last fresh locations.

## Test Plan

- Unit test key import, pubkey derivation, NIP-05 lookup, NIP-42 auth event creation, NIP-44 vectors, payload validation, expiration handling, and approximate-location snapping.
- Integration test against local `nip42relay`: unauthenticated read fails, authenticated publish succeeds, wrong-pubkey publish fails, expired events are ignored by the app.
- iOS simulator smoke test: import key, authenticate, grant location, add NIP-05 recipient, send invite, receive/decrypt a mocked location event, render marker on MapKit, stop sharing.

## Assumptions

- `Nostrail` is the app name.
- Approximate sharing is the v1 default; exact sharing is out of scope.
- Limited background sharing is required, but only during explicit time-bounded sessions.
- No relay/backend changes are required for v1.
- References: [NIP-01](https://raw.githubusercontent.com/nostr-protocol/nips/master/01.md), [NIP-05](https://raw.githubusercontent.com/nostr-protocol/nips/master/05.md), [NIP-42](https://raw.githubusercontent.com/nostr-protocol/nips/master/42.md), [NIP-44](https://raw.githubusercontent.com/nostr-protocol/nips/master/44.md), [P256K docs](https://docs.21.dev/documentation/p256k/).
