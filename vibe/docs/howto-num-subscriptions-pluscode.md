# How To: Count Subscriptions Per Pluscode (via kind `10395`)

This document defines the design for showing subscription counts per pluscode in `nr-web`, using **daemon-derived aggregate events**.

It covers two linked goals:

1. adopt kind `10395` publishing in `nr-web`, and
2. visualize per-pluscode subscription counts in `nr-web`.

## Why this needs daemon-derived stats

Raw kind `10395` events are encrypted for the notification daemon pubkey. Browser clients cannot decrypt that payload, so `nr-web` cannot compute global counts directly from raw `10395` relay traffic.

Therefore:

- notification daemon decrypts `10395` events,
- daemon computes per-pluscode aggregates, and
- daemon republishes **public aggregate stats events** that `nr-web` can subscribe to.

## Architecture

### Source of truth

- **Private source:** kind `10395` notification subscription events (encrypted payload).
- **Public derived source:** new aggregate stats events, published by notification daemon.

### Data flow

1. `nr-app` and `nr-web` publish kind `10395` events with notification filters.
2. Notification daemon consumes those events (relay bootstrap + Rabbit stream), decrypts payload, validates filters, and updates in-memory subscription state.
3. Daemon recalculates per-pluscode counts and publishes one aggregate event per pluscode.
4. `nr-web` subscribes to aggregate stats events and renders counts in Host & Meet.

## Public interfaces and event shapes

### Kind `10395` producer tags

Add a `client` tag on all new `10395` events:

- `["client", "nr-app"]`
- `["client", "nr-web"]`

Legacy `10395` without this tag remains supported (see defaults below).

### Aggregate stats kind

Use a new parameterized replaceable kind for per-pluscode stats:

- **kind:** `30396` (recommended)
- **replace key:** `(kind, pubkey, d-tag)`
- **d tag value:** exact pluscode

Required tags:

- `["d", "<PLUSCODE>"]`
- `["L", "open-location-code"]`
- `["l", "<PLUSCODE>", "open-location-code"]`

Optional marker:

- `["clientBreakdown", "1"]`

Content JSON:

```json
{
  "plusCode": "9F3HC2J7+",
  "total": 42,
  "nrApp": 30,
  "nrWeb": 12,
  "updatedAt": 1760000000
}
```

Field semantics:

- `plusCode`: canonical pluscode key for this event.
- `total`: unique subscriber count for this pluscode.
- `nrApp`: subscriber count where latest source is `nr-app`.
- `nrWeb`: subscriber count where latest source is `nr-web`.
- `updatedAt`: unix seconds when daemon produced this aggregate snapshot.

## Shared constants/schemas updates

Implementation phase should add:

- new kind constant for `30396` in shared constants,
- schema for aggregate stats content/event in `nr-common`,
- acceptance wiring so relay pipeline and validators accept `30396`.

## Daemon aggregation rules

### Input parsing from `10395`

From decrypted payload, count only filters that represent map-note subscriptions:

- `kinds` contains `30398`,
- pluscode label tags present (`#L` includes `open-location-code`, `#l` has one or more pluscodes).

Ignore filters that do not match this profile.

### Counting model

- Identity key for counting: **subscriber pubkey** (event author of `10395`).
- Per pluscode, count unique subscriber pubkeys.
- Client split (`nrApp`/`nrWeb`) is derived from the **latest known `10395` client tag for that pubkey**.

Default for legacy/no-client-tag `10395`:

- treat as `nr-app`.

### Update behavior

On any relevant subscription update:

1. update pubkey subscription state from latest valid `10395`,
2. recalculate affected pluscodes,
3. republish latest `30396` parameterized event(s) for changed pluscodes.

Because `30396` is parameterized replaceable, the latest event per pluscode supersedes older values.

## `nr-web` behavior

### Keep existing local browser notifications

Do not remove or regress current browser-local notification flow in `nr-web`. Existing local UX remains valid and independent.

### Add `10395` publishing in `nr-web`

When user subscribes/unsubscribes pluscodes in `nr-web`:

- build notification payload matching `nr-app` semantics,
- encrypt payload for notification server pubkey,
- publish kind `10395` with `["client","nr-web"]`.

For `nr-web`, `tokens` may be empty.

### Subscribe to aggregate stats

`nr-web` subscribes to kind `30396` and stores latest stats by pluscode.

Display location:

- Host & Meet header (same area as subscribe/unsubscribe control).

Display format:

- total + split (`nr-app`, `nr-web`) when available.
- graceful fallback if stats missing/stale (for example: "No subscription stats yet").

## Testing plan

### Notification daemon unit tests

1. decrypt/parse `10395` with `client` tag variants.
2. extract pluscodes only from valid map-note subscription filters.
3. legacy no-client-tag default to `nr-app`.
4. aggregate math: `total`, `nrApp`, `nrWeb`.
5. replacement/update semantics for same pubkey and pluscode.

### Pipeline/integration tests

1. new `30396` kind accepted by whitelist/validation pipeline.
2. daemon publishes `30396` events after `10395` updates.
3. parameterized replaceable behavior keeps latest snapshot per pluscode.

### `nr-web` tests

1. publishes `10395` on subscribe/unsubscribe actions.
2. receives/parses/stores `30396` stats events.
3. Host & Meet header renders count values correctly.
4. graceful empty/error state when no `30396` event exists yet.

## Assumptions and defaults

- Primary visualization is Host & Meet header.
- Count display default is `total` + split (`nr-app`, `nr-web`).
- No browser-side decryption attempt for `10395`.
- This document is a design/how-to spec only; implementation is a follow-up phase.
