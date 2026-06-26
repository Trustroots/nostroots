# Add Plus-Code Subscription Stats

## Summary

Publish daemon-derived public aggregate subscription counts per plus code and
render them in Vibe Web. Raw subscription events remain encrypted and private;
the daemon is responsible for deriving public count snapshots.

## Motivation

Vibe Web cannot compute global subscription counts from encrypted subscription
traffic. A public aggregate event lets users see interest around a place without
exposing raw subscription payloads.

## Impact

- Adds a public aggregate stats event, recommended kind `30396`.
- Adds `client` tags to new kind `10395` producers.
- Extends daemon aggregation and Vibe Web display behavior.
- Keeps existing local browser notification UX intact.
