# Continue iOS Browser Backlog

## Summary

Continue hardening and expanding the native iOS browser/Swiftroots track using
`nr-web` as the behavior source of truth where product behavior overlaps.

## Motivation

The native iOS track has a working foundation, but the backlog still includes
crypto hardening, relay runtime depth, storage/onboarding hardening, broader
product surfaces, and APNs integration.

## Impact

- Keeps SwiftUI/iOS-first direction.
- Treats `vibe/browser/ios` and `vibe/web/ios-app` native work as Vibe-native
  implementation tracks.
- Defers Pixel and non-core extra map layers from first-class v1 scope.
