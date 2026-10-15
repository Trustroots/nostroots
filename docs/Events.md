# Events

This page documents every Nostr event kind that Nostroots publishes, reads or accepts on its relay, so that an external developer can interoperate with it from one place. Facts here are derived from the code; the source of truth is [`nr-common/constants.ts`](../nr-common/constants.ts) and the Zod schemas in [`nr-common/src/`](../nr-common/src/).

For the proposal to move towards more established Nostr formats, see [#305](https://github.com/Trustroots/nostroots/issues/305). This page describes what is implemented today, not that proposal. The separate `vibe/` web client has its own additions in [`vibe/docs/Events.md`](../vibe/docs/Events.md).

## Overview

| Kind | Name | Type | Published by | Read by | Audience |
| --- | --- | --- | --- | --- | --- |
| `0` | User metadata (NIP-01) | replaceable | users | `nr-server` (fallback username lookup) | public, standard |
| `5` | Event deletion (NIP-09) | regular | users | nobody in this repository | public, standard, accepted by the relay only |
| `10390` | Trustroots profile | replaceable | users (`nr-app`) | `nr-server`, `nr-app` | public, Nostroots-specific |
| `10395` | Notification subscription | replaceable | users (`nr-app`) | `nr-notification-daemon` | semi-internal, content is encrypted |
| `20398` | Server message | ephemeral | `nr-server` | `nr-app` | internal operations |
| `20400` | Ping / ack | ephemeral | `nr-monitor`, services | `nr-server`, `nr-notification-daemon`, `nr-monitor` | internal operations |
| `30397` | Map note (unvalidated) | addressable | users (`nr-app`) | `nr-server`, `nr-app` | public, Nostroots-specific |
| `30398` | Map note (validated copy) | addressable | `nr-server` | `nr-app` | public, Nostroots-specific |
| `30399` | Third-party map data | addressable | third-party importers | `nr-app` | public, Nostroots-specific |
| `30400` | Metrics snapshot | addressable | `nr-server`, `nr-notification-daemon` | `nr-app` | internal operations |

The relay accepts only the kinds in `ACCEPTED_KINDS` ([`nr-common/constants.ts`](../nr-common/constants.ts)); [`nr-relay-to-rabbit/src/whitelistKinds.ts`](../nr-relay-to-rabbit/src/whitelistKinds.ts) enforces the list. Any other kind is rejected.

## Canonical events and validation

- **`30397` is the canonical, user-authored event.** It is signed by the user's own key and is what the author edits or deletes.
- **`30398` is a server-authored copy.** `nr-server` ([`nr-server/src/validation/repost.ts`](../nr-server/src/validation/repost.ts)) receives each `30397`, validates it, and if it passes, signs and publishes a `30398` with its own key (`NOSTROOTS_VALIDATION_PUBKEY`). The copy carries the original author in its `p` tag and the original event id in its `e` tag.
- **What validation means** ([`nr-server/src/validation/validate.ts`](../nr-server/src/validation/validate.ts)): the author has a Trustroots username (from their kind `10390` event, falling back to a `trustrootsUsername` field in their kind `0` content), that username resolves through NIP-05 to a pubkey, and that pubkey equals the author of the `30397`. Nothing else is checked: validation says the author controls a Trustroots account, not that the note is accurate.
- **If validation fails**, no `30398` is published and `nr-server` publishes a kind `20398` message of type `error` tagged with the rejected event, explaining why.
- **Why validation is a copy and not a NIP-32 label.** Nostroots does not mark validated notes with NIP-32 label events (kind `1985`). Kind `1985` is not replaceable, so a label cannot be cleanly updated or revoked in place. Labels would also complicate queries: a label is a separate event that points at the note, so a client could not select validated notes in one filter. `nr-app` currently runs a single relay filter per layer, with `kinds`, `since`, `limit` and the plus code prefix tags (see [`nr-app/src/common/utils.ts`](../nr-app/src/common/utils.ts)), and with a separate `30398` that filter alone selects validated notes. With labels the client would need to query the labels and the notes separately and join them by event id.
- **Revocation is not automated.** Nothing in this repository revalidates or deletes an existing `30398` after a ban, a username change or a NIP-05 key change, and deleting a `30397` does not delete its `30398`. This is an open question in [#305](https://github.com/Trustroots/nostroots/issues/305).
- **Replies, reactions and deletions** have no Nostroots-specific handling today. `nr-app` does not publish them. `getAuthorFromEvent` ([`nr-common/src/getAuthorFromEvent.ts`](../nr-common/src/getAuthorFromEvent.ts)) maps a `30398` back to its original author through the `p` tag; every other kind is attributed to its signing pubkey. Clients that show both kinds must deduplicate a `30397` and its `30398` themselves, using the `e` tag.

## Location and label tags

Locations are expressed as Open Location Code (Plus Code) labels using NIP-32 style `L` / `l` tags, not as `g` geohash tags.

- `["L", "open-location-code"]` and `["l", "<full plus code>", "open-location-code"]`: the location of the note. `30397` and `30398` events without a valid plus code are rejected by the schema (`tagsIncludingPlusCodeSchema`).
- `["L", "open-location-code-prefix"]` and `["l", "<prefix>", "<prefix>", ..., "open-location-code-prefix"]`: all prefixes of the plus code down to a minimum length of 2 characters, as an index for relay filters. A Nostroots index is under construction; its plan is that every event carries all of these prefix tags so events can be queried by plus code prefix. Today only `30397` (added by `nr-app`) and `30398` carry them; other kinds do not. Clients add these on `30397`; `nr-server` derives them again on `30398` (`getAllPlusCodePrefixes`, `DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH`).
- `["L", "trustroots-circle"]` and `["l", "<slug>", "trustroots-circle"]`: optional circle (tribe) the event relates to; the value is a lowercase slug with ASCII hyphens removed.
- `["expiration", "<unix seconds>"]`: optional NIP-40 expiry. `nr-app` sets it when the user picks an expiry for a note.
- `["t", "signal"]` and `["t", "<intent>"]`: `nr-app` adds these to notes published as signals (see [`nr-app/src/redux/actions/publish.actions.ts`](../nr-app/src/redux/actions/publish.actions.ts)).

## Kinds

### `0` User metadata and `5` Event deletion

Standard NIP-01 and NIP-09 kinds. Kind `0` is not the canonical place for the Trustroots username, because other apps overwrite it regularly and users may not want one shared profile across apps; see [`10390`](#10390-trustroots-profile). They are in `ACCEPTED_KINDS` so users can publish them to the relay. The only Nostroots code that reads one is `nr-server`, which queries kind `0` for a `trustrootsUsername` field when a user has no kind `10390` event. Deletion requests are accepted by the relay but not acted on by any Nostroots service.

### `10390` Trustroots profile

Links a Nostr pubkey to a Trustroots username. Replaceable, so a user has one. Nostroots uses its own event for this instead of kind `0` because kind `0` is replaceable too and other Nostr apps and clients overwrite it regularly (last write wins), which would drop the username link, and because users may not want the same profile across every app they use. Schema: [`nr-common/src/10390.schema.ts`](../nr-common/src/10390.schema.ts). Published by `nr-app` during onboarding ([`nr-app/app/onboarding/link.tsx`](../nr-app/app/onboarding/link.tsx)) and read by `nr-server` for validation.

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

A user's request for push notifications. Replaceable. Schema: [`nr-common/src/10395.schema.ts`](../nr-common/src/10395.schema.ts). Published by `nr-app` ([`nr-app/src/redux/sagas/notifications.saga.ts`](../nr-app/src/redux/sagas/notifications.saga.ts)) and consumed by `nr-notification-daemon`.

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

An ephemeral message from `nr-server` to a user, currently only used to explain why a `30397` was not reposted. Schema: [`nr-common/src/20398.schema.ts`](../nr-common/src/20398.schema.ts). Published by `nr-server`; `nr-app` subscribes to it ([`nr-app/src/redux/sagas/serverMessages.saga.ts`](../nr-app/src/redux/sagas/serverMessages.saga.ts)).

- `content`: human-readable reason, at least one character.
- Tags: `p` (the rejected event's author), `e` (the rejected event's id), `["serverMessageType", "error" | "info"]`. All three are optional in the schema; `nr-server` always sends `error`.

### `20400` Ping and ack

Liveness check between services. Schema: [`nr-common/src/20400.schema.ts`](../nr-common/src/20400.schema.ts).

- A **ping** has `content: "ping"` and one or more `p` tags naming the service to check. `nr-monitor` publishes it.
- An **ack** has `content: "ack"`, an `e` tag with the ping's id and a `p` tag with the pinger's pubkey. `nr-server` and `nr-notification-daemon` answer pings addressed to their own pubkey.

### `30397` Map note

A user's note at a location. Addressable, so the `d` tag is the identifier. Nostroots uses its own kind here instead of kind `1` so that notes can be edited or replaced (kind `1` events are not replaceable), and so that other Nostr clients do not easily parse them and pull Nostroots notes into feeds on other apps. This is a separate event domain rather than obfuscation: the events are public and documented on this page. Schema: [`nr-common/src/30397.schema.ts`](../nr-common/src/30397.schema.ts). Published by `nr-app` ([`nr-app/src/redux/actions/publish.actions.ts`](../nr-app/src/redux/actions/publish.actions.ts)) and read by `nr-server` (to validate) and by `nr-app` (the "Unverified" map layer).

- `content`: plain text, 3 to 4000 characters.
- Tags: `d` (`nr-app` uses a nanoid), the plus code and prefix labels described above, and optionally `expiration`, circle labels and `t` tags.

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
    ["l", "8FXHH800+", "8F000000+", "open-location-code-prefix"]
  ]
}
```

### `30398` Validated map note

The server-signed copy of a `30397` that passed validation. It is a validation event used for spam filtering: clients that want only notes from Trustroots users read `30398` instead of `30397`. Known gap: there is currently no way to remove a banned user's events, including ones that were already validated (see the revocation note above). Addressable. Schema: [`nr-common/src/30398.schema.ts`](../nr-common/src/30398.schema.ts). Generated by `generateRepostedEvent` in [`nr-server/src/validation/repost.ts`](../nr-server/src/validation/repost.ts). Read by `nr-app` for the Trustroots map layer, the feed, signals and events tabs, and push notification filters.

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
    ["l", "8FXHH800+", "8F000000+", "open-location-code-prefix"]
  ]
}
```

Clients that want only validated notes filter on `kinds: [30398]` and `authors: [NOSTROOTS_VALIDATION_PUBKEY]`, as the Trustroots layer in `MAP_LAYERS` does ([`nr-common/constants.ts`](../nr-common/constants.ts)). Other authors can also publish `30398` events; `nr-app` shows some as separate layers (for example Trip Hopping).

### `30399` Third-party map data

Notes imported from other projects (Hitchwiki, Time Safari and others) and published by an importer under its own key. Addressable. Nostroots has no Zod schema for it; `nr-app` reads it as a map layer by author pubkey. Consumers should treat the tags below as the format.

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
    ["l", "8GM87X00+", "8GM80000+", "8G000000+", "open-location-code-prefix"],
    ["L", "trustroots-circle"],
    ["l", "hitchhikers", "trustroots-circle"],
    ["linkLabel", "posted by @jdoe"],
    ["linkPath", "/point/123"]
  ]
}
```

### `30400` Metrics snapshot

Aggregate counts per plus code, used by the app to show activity. Addressable and short-lived. Schema: [`nr-common/src/30400.schema.ts`](../nr-common/src/30400.schema.ts). `nr-server` publishes the `messages` type ([`nr-server/src/metrics/messages.ts`](../nr-server/src/metrics/messages.ts)) and `nr-notification-daemon` publishes `push-subscriptions` ([`nr-notification-daemon/src/metrics.ts`](../nr-notification-daemon/src/metrics.ts)); `nr-app` reads them ([`nr-app/src/redux/sagas/metrics.saga.ts`](../nr-app/src/redux/sagas/metrics.saga.ts)).

- `content`: a JSON object whose keys are plus codes and whose values are non-negative integers.
- Tags: exactly one `d` (currently `world`), exactly one `["t", "messages" | "push-subscriptions"]`, and an `expiration` 30 days after `created_at`.

## Reference

- Kind constants and `ACCEPTED_KINDS`: [`nr-common/constants.ts`](../nr-common/constants.ts)
- Schemas and validators: [`nr-common/src/`](../nr-common/src/), dispatched by [`nr-common/src/isValidEvent.ts`](../nr-common/src/isValidEvent.ts)
- Validation and reposting: [`nr-server/src/validation/`](../nr-server/src/validation/)
