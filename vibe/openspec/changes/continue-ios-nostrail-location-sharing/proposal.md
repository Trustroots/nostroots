# Continue iOS Nostrail Location Sharing

## Summary

Continue hardening the native Nostrail temporary encrypted location-sharing
track.

## Motivation

Nostrail already has a native map-first slice, encrypted one-recipient-per-event
fanout, approximate Plus Code location sharing, relay recovery, and Keychain
storage. Remaining work focuses on production readiness and broader runtime
coverage.

## Impact

- Preserves temporary, approximate, encrypted location sharing as the product
  center.
- Keeps one encrypted event per recipient and expiration-aware received marker
  behavior.
- Adds hardening rather than broadening into public map notes, profiles, chat, or
  APNs unless a later change says otherwise.
