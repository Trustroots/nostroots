# Events

This page documents every Nostr event kind that Nostroots publishes, reads or accepts on its relay, so that an external developer can interoperate with it from one place. Facts here are derived from the code; the source of truth is [`nr-common/constants.ts`](../nr-common/constants.ts) and the Zod schemas in [`nr-common/src/`](../nr-common/src/).

Before proposing a new kind or NIP, read [CONTRIBUTING.md](../CONTRIBUTING.md) and [PHILOSOPHY.md](../PHILOSOPHY.md). The design rationale below (why Nostroots uses its own kinds) is part of what a proposal has to take into account.

## Overview

| Kind | Name | Type | Published by | Audience |
| --- | --- | --- | --- | --- |
| `0` | User metadata (NIP-01) | replaceable | users | public, standard |
| `5` | Event deletion (NIP-09) | regular | users | public, standard, accepted by the relay only |
| `10390` | Trustroots profile | replaceable | users | public, Nostroots-specific |
| `10395` | Notification subscription | replaceable | users | semi-internal, content is encrypted |
| `20398` | Server message | ephemeral | validation server | internal operations |
| `20400` | Ping / ack | ephemeral | monitoring and services | internal operations |
| `30397` | Map note (unvalidated) | addressable | users | public, Nostroots-specific |
| `30398` | Map note (validated copy) | addressable | validation server | public, Nostroots-specific |
| `30399` | Third-party map data | addressable | third-party importers | public, Nostroots-specific |
| `30400` | Metrics snapshot | addressable | servers | internal operations |

The relay accepts only the kinds in `ACCEPTED_KINDS` ([`nr-common/constants.ts`](../nr-common/constants.ts)); [`nr-relay-to-rabbit/src/whitelistKinds.ts`](../nr-relay-to-rabbit/src/whitelistKinds.ts) enforces the list. Any other kind is rejected.

## Canonical events and validation

- **`30397` is the canonical, user-authored event.** It is signed by the user's own key and is what the author edits or deletes.
- **`30398` is a server-authored copy.** The validation server ([`nr-server/src/validation/repost.ts`](../nr-server/src/validation/repost.ts)) receives each `30397`, validates it, and if it passes, signs and publishes a `30398` with its own key (`NOSTROOTS_VALIDATION_PUBKEY`). The copy carries the original author in its `p` tag and the original event id in its `e` tag.
- **What validation means** ([`nr-server/src/validation/validate.ts`](../nr-server/src/validation/validate.ts)): the author has a Trustroots username (from their kind `10390` event, falling back to a `trustrootsUsername` field in their kind `0` content), that username resolves through NIP-05 to a pubkey, and that pubkey equals the author of the `30397`. Nothing else is checked: validation says the author controls a Trustroots account, not that the note is accurate.
- **If validation fails**, no `30398` is published and the server publishes a kind `20398` message of type `error` tagged with the rejected event, explaining why.
- **Why validation is a copy and not a NIP-32 label.** Nostroots does not mark validated notes with NIP-32 label events (kind `1985`). Kind `1985` is not replaceable, so a label cannot be cleanly updated or revoked in place. Labels would also complicate queries: a label is a separate event that points at the note, so a client could not select validated notes in one filter. Today a layer is fetched with a single relay filter (`kinds`, `since`, `limit` and the plus code prefix tags), and with a separate `30398` kind that filter alone selects validated notes. With labels a client would need to query the labels and the notes separately and join them by event id.
- **The validation server is not full-featured yet.** This is the underlying reason why revocation does not exist and validations can become stale: nothing revalidates an existing `30398` after a ban, a username change or a NIP-05 key change, and deleting a `30397` does not delete its `30398`. For now there is no way to remove a banned user's events, even ones that were already validated. Deletions in general are part of the same unfinished work.
- **Replies, reactions and deletions** have no Nostroots-specific handling yet. `getAuthorFromEvent` ([`nr-common/src/getAuthorFromEvent.ts`](../nr-common/src/getAuthorFromEvent.ts)) maps a `30398` back to its original author through the `p` tag; every other kind is attributed to its signing pubkey. Clients that show both kinds must deduplicate a `30397` and its `30398` themselves, using the `e` tag.

## Location and label tags

Locations are expressed as Open Location Code (Plus Code) labels using NIP-32 style `L` / `l` tags, not as `g` geohash tags.

- `["L", "open-location-code"]` and `["l", "<full plus code>", "open-location-code"]`: the location of the note. `30397` and `30398` events without a valid plus code are rejected by the schema (`tagsIncludingPlusCodeSchema`).
- `["L", "open-location-code-prefix"]` and one `["l", "<prefix>", "open-location-code-prefix"]` tag for each prefix of the plus code at lengths 2, 4, 6 and 8, zero-padded to 8 characters before the `+` (for `8FXHH82F+36`: `8F000000+`, `8FXH0000+`, `8FXHH800+`, `8FXHH82F+`). Use a separate tag per prefix, because Nostr relays index only the first value of a tag ([NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md#tags)). They are an index for relay filters. A Nostroots index is under construction; its plan is that every event carries all of these prefix tags so events can be queried by plus code prefix. Today only `30397` and `30398` carry them; other kinds do not. Clients add them on `30397`; the validation server derives them again on `30398` (`getAllPlusCodePrefixes`, `DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH`).
- `["L", "trustroots-circle"]` and `["l", "<slug>", "trustroots-circle"]`: optional circle (tribe) the event relates to; the value is a lowercase slug with ASCII hyphens removed.
- `["expiration", "<unix seconds>"]`: optional NIP-40 expiry, set when the user picks an expiry for a note.
- `["t", "signal"]` and `["t", "<intent>"]`: added to notes published as signals (see [`nr-app/src/redux/actions/publish.actions.ts`](../nr-app/src/redux/actions/publish.actions.ts)).

## Why Plus Codes, not geohash

We would like to avoid discussions on this topic, as it is not a priority during our current development phase.

Plus Codes were picked over geohashes because they are better suited to the job. Both a Plus Code and a geohash identify an area, not a point, and a shared prefix means a shared containing cell, which is what the prefix tags above rely on. Plus Codes are easier to test and validate.

Background, with sources:

- The [Open Location Code specification](https://github.com/google/open-location-code/blob/main/Documentation/Specification/specification.md) fixes the alphabet, the format (the `+` separator after the 8th digit, zero padding only before it, valid lengths) and case-insensitive input, so malformed codes can be rejected without decoding (see `isPlusCode` in [`nr-common/src/utils.ts`](../nr-common/src/utils.ts)). Any string of [geohash](https://en.wikipedia.org/wiki/Geohash) alphabet characters decodes to some cell.
- The [Open Location Code repository](https://github.com/google/open-location-code/tree/main/test_data) ships CSV test vectors for validity, encoding, decoding and short codes that its reference implementations run.
- Neither system avoids the usual limits of prefix queries: nearby points can fall into cells with different prefixes, and cells get narrower in metres away from the equator.

## Kinds

### `0` User metadata and `5` Event deletion

Standard NIP-01 and NIP-09 kinds, accepted by the relay so users can publish them. Nostroots only uses kind `0` as a fallback source of a `trustrootsUsername` field when a user has no kind `10390` event. Deletion requests are accepted but not acted on.

### `10390` Trustroots profile

Links a Nostr pubkey to a Trustroots username. Replaceable (NIP-01): a newer event from the same pubkey replaces the older one, so a user has one. Nostroots uses its own event for this instead of kind `0`, because kind `0` is not the canonical place for the username: other apps overwrite it regularly (last write wins) and users may not want one shared profile across apps. Schema: [`nr-common/src/10390.schema.ts`](../nr-common/src/10390.schema.ts). Published by users during onboarding.

- `content`: empty string.
- Tags: exactly the username label, with a username of at least 3 characters.

```json
{
  "kind": 10390,
  "content": "",
  "created_at": 1729246181,
  "tags": [
    ["L", "org.trustroots:username"],
    ["l", "jdoe", "org.trustroots:username"]
  ]
}
```

### `10395` Notification subscription

A user's request for push notifications. Replaceable. Schema: [`nr-common/src/10395.schema.ts`](../nr-common/src/10395.schema.ts).

- `content`: a NIP-04 encrypted string, encrypted to `NOTIFICATION_SERVER_PUBKEY`. Decrypted, it is JSON of the form `{ "tokens": [{ "expoPushToken": "..." }], "filters": [{ "filter": <nostr filter> }] }`.
- Tags: a single `p` tag with `NOTIFICATION_SERVER_PUBKEY`.

```json
{
  "kind": 10395,
  "content": "<NIP-04 ciphertext>",
  "created_at": 1729246181,
  "tags": [["p", "62ab89bfb4f0e1f4f64653bfef77fcf4e9062cd9585a97d6b1f17ff953e4e032"]]
}
```

### `20398` Server message

An ephemeral message from the validation server to a user, currently only used to explain why a `30397` was not reposted. Schema: [`nr-common/src/20398.schema.ts`](../nr-common/src/20398.schema.ts).

- `content`: human-readable reason, at least one character.
- Tags: `p` (the rejected event's author), `e` (the rejected event's id), `["serverMessageType", "error" | "info"]`. All three are optional in the schema; the server currently always sends `error`.

### `20400` Ping and ack

Liveness check between services. Schema: [`nr-common/src/20400.schema.ts`](../nr-common/src/20400.schema.ts).

- A **ping** has `content: "ping"` and one or more `p` tags naming the service to check. The monitor publishes it.
- An **ack** has `content: "ack"`, an `e` tag with the ping's id and a `p` tag with the pinger's pubkey. Services answer pings addressed to their own pubkey.

### `30397` Map note

A user's note at a location. Addressable. Schema: [`nr-common/src/30397.schema.ts`](../nr-common/src/30397.schema.ts).

Nostroots uses its own kind here, rather than kind `1`, for prototyping purposes: replaceable events are a core part of the app later on, and notes by themselves are considered ephemeral anyway. Kind `1` events are not replaceable, so notes could not be edited. The separate kind also keeps Nostroots notes in their own domain within the Nostr ecosystem while keeping them public.

- `content`: plain text, 3 to 4000 characters.
- Tags: `d`, the plus code and prefix labels described above, and optionally `expiration`, circle labels and `t` tags.

```json
{
  "kind": 30397,
  "content": "Hitchhikers: you might be able to get out of Nuremberg on the A9 towards Berlin here.",
  "created_at": 1727447770,
  "tags": [
    ["d", "V1StGXR8_Z5jdHi6B-myT"],
    ["L", "open-location-code"],
    ["l", "8FXHH82F+36", "open-location-code"],
    ["L", "open-location-code-prefix"],
    ["l", "8F000000+", "open-location-code-prefix"],
    ["l", "8FXH0000+", "open-location-code-prefix"],
    ["l", "8FXHH800+", "open-location-code-prefix"],
    ["l", "8FXHH82F+", "open-location-code-prefix"]
  ]
}
```

### `30398` Validated map note

The server-signed copy of a `30397` that passed validation. Addressable. Schema: [`nr-common/src/30398.schema.ts`](../nr-common/src/30398.schema.ts). Generated by `generateRepostedEvent` in [`nr-server/src/validation/repost.ts`](../nr-server/src/validation/repost.ts).

We validate for a few quick reasons: it filters spam, because only notes from authors with a verifiable Trustroots account get a copy; clients can ask for validated notes with a single filter on kind and author; and the user's original stays untouched. See [Canonical events and validation](#canonical-events-and-validation) for what is checked.

- `content`: copied from the original.
- Tags: `e` (original event id), `p` (original author pubkey), `d` (`<original pubkey>:<original kind>:<original d tag value>`), `original_created_at` (the original's `created_at`), then the original's tags except `d`, then freshly derived plus code prefix labels.

```json
{
  "kind": 30398,
  "content": "Hitchhikers: you might be able to get out of Nuremberg on the A9 towards Berlin here.",
  "created_at": 1727447790,
  "pubkey": "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b",
  "tags": [
    ["e", "<id of the 30397>"],
    ["p", "<pubkey of the 30397 author>"],
    ["d", "<pubkey of the 30397 author>:30397:V1StGXR8_Z5jdHi6B-myT"],
    ["original_created_at", "1727447770"],
    ["L", "open-location-code"],
    ["l", "8FXHH82F+36", "open-location-code"],
    ["L", "open-location-code-prefix"],
    ["l", "8F000000+", "open-location-code-prefix"],
    ["l", "8FXH0000+", "open-location-code-prefix"],
    ["l", "8FXHH800+", "open-location-code-prefix"],
    ["l", "8FXHH82F+", "open-location-code-prefix"]
  ]
}
```

Clients that want only validated notes filter on `kinds: [30398]` and `authors: [NOSTROOTS_VALIDATION_PUBKEY]`, as the Trustroots layer in `MAP_LAYERS` does ([`nr-common/constants.ts`](../nr-common/constants.ts)). Other authors can also publish `30398` events, which clients can show as separate layers (for example Trip Hopping).

### `30399` Third-party map data

Notes imported from other projects (Hitchwiki, Time Safari and others) and published by an importer under its own key. Addressable. The kind is a standardized event format for whitelisted parties to publish on Nostroots. Today the whitelist is the set of publisher pubkeys hard-coded as map layers in `MAP_LAYERS` ([`nr-common/constants.ts`](../nr-common/constants.ts)); each layer is read with a filter on `kinds: [30399]` and the publisher's pubkey, so events from other pubkeys are not shown. Nostroots has no Zod schema for it yet, so the tags below are the format by convention. Other kinds can be supported as needed, but that requires checking interoperability first, for example geohash `g` tags versus the Plus Code labels Nostroots uses for location.

- `content`: the note text.
- `d`: required, chosen by the publisher to be unique per note.
- Plus code and prefix labels: required for the note to appear on the map.
- Optional: `e` and `p` when the note refers to another Nostr event or pubkey, `original_created_at` when upstream has its own creation time, circle labels, `linkLabel` (text of the link shown with the note) and `linkPath` (URL path of the link, joined to the host registered for the publisher's pubkey).

```json
{
  "kind": 30399,
  "content": "An example note posted by a third party collaborator to be shown in the Trustroots app",
  "created_at": 1729246181,
  "tags": [
    ["d", "unique_identifier_for_this_event"],
    ["L", "open-location-code"],
    ["l", "8GM87XXC+47", "open-location-code"],
    ["L", "open-location-code-prefix"],
    ["l", "8G000000+", "open-location-code-prefix"],
    ["l", "8GM80000+", "open-location-code-prefix"],
    ["l", "8GM87X00+", "open-location-code-prefix"],
    ["l", "8GM87XXC+", "open-location-code-prefix"],
    ["L", "trustroots-circle"],
    ["l", "hitchhikers", "trustroots-circle"],
    ["linkLabel", "posted by @jdoe"],
    ["linkPath", "/point/123"]
  ]
}
```

### `30400` Metrics snapshot

Aggregate counts per plus code, used to show activity. Addressable and short-lived. Schema: [`nr-common/src/30400.schema.ts`](../nr-common/src/30400.schema.ts). The validation server publishes the `messages` type ([`nr-server/src/metrics/messages.ts`](../nr-server/src/metrics/messages.ts)) and the notification service publishes `push-subscriptions` ([`nr-notification-daemon/src/metrics.ts`](../nr-notification-daemon/src/metrics.ts)).

- `content`: a JSON object whose keys are plus codes and whose values are non-negative integers.
- Tags: exactly one `d` (currently `world`), exactly one `["t", "messages" | "push-subscriptions"]`, and an `expiration` 30 days after `created_at`.

## Reference

- Kind constants and `ACCEPTED_KINDS`: [`nr-common/constants.ts`](../nr-common/constants.ts)
- Schemas and validators: [`nr-common/src/`](../nr-common/src/), dispatched by [`nr-common/src/isValidEvent.ts`](../nr-common/src/isValidEvent.ts)
- Validation and reposting: [`nr-server/src/validation/`](../nr-server/src/validation/)
