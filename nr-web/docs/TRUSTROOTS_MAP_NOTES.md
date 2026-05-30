# Trustroots map-note validation in nr-web

This document explains how `nr-web` treats Trustroots map-note trust for kinds `30397` and `30398`.

## Two paths in this repository

### Path A: `30397 -> nr-server -> 30398` (mobile/public-relay oriented)

- User publishes map note kind `30397`.
- `nr-server` validates Trustroots identity/linking.
- Server republishes as kind `30398`.
- Clients can treat `30398` as Trustroots-validated reposts.

This is the common flow for public-relay/mobile delivery and push filtering.

### Path B: `30397` on `wss://nip42.trustroots.org` (nr-web oriented)

- `nr-web` defaults include `wss://nip42.trustroots.org`.
- Reads and writes on that relay use NIP-42 AUTH.
- In this deployment, posting to that relay is de facto Trustroots-scoped, because relay access is tied to a linked Trustroots identity.

For `nr-web` product behavior, a kind `30397` seen via this auth relay should not be treated like an arbitrary unvalidated `30397` from random public relays.

## How this appears in current nr-web code

- NIP-42 AUTH subscribe/publish helpers: `common.js`.
- Map app relay usage and sync paths: `index.html`.
- Profile classification for validated map notes (treats `30398` as validated, and `30397` from auth relay as validated for profile UI): `nr-profile-page.js`.

## Relay-scope metadata vs validation

`relayScope` (`public`/`auth`) is client metadata used for display and can be missing on subscription-only events. It is useful context, but it is not a protocol-level validation proof.

See `docs/RELAY_SCOPE_UI.md` for relay-scope pill behavior and caveats.

## Notes on imports

Trustroots-side exports/import tooling and profile/host mirrors can produce events consumed by `nr-web` alongside user-authored map notes. In practice, nr-web surfaces both:

- auth-relay map notes (`30397` on NIP-42 relay), and
- mirrored/validated repost flows (`30398`) where available.

## Testing note

Automated CI coverage is mostly public-relay oriented. For explicit NIP-42 challenge/response behavior, use `test.html` as noted in `README.md`.
