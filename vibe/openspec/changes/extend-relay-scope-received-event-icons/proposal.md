# Extend Relay Scope Received Event Icons

## Summary

Add relay-scope display for received events only when the receiving code can
track the relay URL or another explicit source signal.

## Motivation

Current Vibe Web behavior intentionally avoids showing public/private relay
icons for subscription-only events because plain Nostr events do not include
relay-scope metadata. Better source tracking can improve UI without restoring
false public labels.

## Impact

- Threads relay-of-origin data through subscription handling.
- Derives display scope from explicit source URLs or shows an unknown state.
- Keeps the current privacy rule: unknown MUST NOT mean public.
