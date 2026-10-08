## Events

This page describes the events as they are implemented today, taken from the schemas in `nr-common` (`constants.ts` and `src/*.schema.ts`). The relay accepts exactly the kinds in `ACCEPTED_KINDS`; anything else is rejected. A redesign of the kinds is being discussed in [#240](https://github.com/Trustroots/nostroots/issues/240) and is not reflected here.

| Kind | Constant | Purpose | Validation |
| --- | --- | --- | --- |
| 0 | `NOSTR_USER_METADATA_KIND` | Standard Nostr profile metadata ([NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md)) | Base event shape only |
| 5 | `EVENT_DELETION_KIND` | Standard Nostr event deletion ([NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md)) | Base event shape only |
| 10390 | `TRUSTROOTS_PROFILE_KIND` | Links a pubkey to a Trustroots username | Username label required |
| 10395 | `NOTIFICATION_SUBSCRIPTION_KIND` | Encrypted push notification subscription | `content` is a string, no tag checks |
| 20398 | `SERVER_MESSAGE_KIND` | Ephemeral message from a server to a user | Optional `p`, `e` and `serverMessageType` tags are validated |
| 20400 | `PING_ACK_KIND` | Ephemeral ping / ack between a client and a service | `content` is `ping` or `ack`, `p` (and for ack `e`) tags required |
| 30397 | `MAP_NOTE_KIND` | User-submitted map note | Plus code label required, `content` 3 to 4000 characters |
| 30398 | `MAP_NOTE_REPOST_KIND` | Server-validated repost of a 30397 | Same as 30397 |
| 30399 | `THIRD_PARTY_EVENT_KIND` | Notes from third-party collaborators | Base event shape only, the tags below are convention |
| 30400 | `NOSTROOTS_METRICS_KIND` | Per-plus-code metrics snapshot | Exactly one `d` and one `t` tag, `content` is a JSON object |

All events share the base shape: `kind`, `created_at`, `tags` (array of string arrays), `content`, `id`, `pubkey` and `sig`, with no additional fields.

### 0 and 5

Standard Nostr events. The relay only checks the base shape.

### 10390: Trustroots profile

Tags: `["L", "org.trustroots:username"]` and `["l", "<username>", "org.trustroots:username"]`. Every label tag needs at least one value and the username must be valid (minimum 3 characters). `content` is empty.

### 10395: Notification subscription

`content` is a NIP-04 encrypted string, encrypted for the notification server. Tags: `["p", "<notification server pubkey>"]`. Decrypted, the content is an object with `tokens` (a list of `{ expoPushToken }`) and `filters` (a list of `{ filter }` using Nostr filters).

### 20398: Server message

Kind 20xxx events are ephemeral. `content` is a non-empty string. Optional tags: `p` (64-char hex pubkey of the recipient), `e` (64-char event id the message refers to) and `serverMessageType` (`error` or `info`).

### 20400: Ping and ack

A ping has `content` `ping` and at least one `p` tag (hex pubkey) targeting a service. An ack has `content` `ack`, at least one `e` tag (event id of the ping) and at least one `p` tag.

### 30397: Map note

An example post that should appear on the map. The schema requires a valid plus code in an `open-location-code` label. It does not currently enforce a `d` tag, and the version check is disabled (TODO in the schema).

```json
{
  "content": "Hitchhikers: you might be able to get out of Nuremberg on the A9 towards Berlin here. Never used it myself, but there might be some climbing involved.",
  "created_at": 1727447770,
  "id": "d7973070d50b58e53705b98953b7b81d33058f6a516cc292805d9d8920d97588",
  "kind": 30397,
  "pubkey": "fe5e4c6132c64427f40c525b9a436f91637cfff3f656ce06c526262406c5a606",
  "sig": "254f18848e32e8a7c0cd30ce858e4ca334093c22feefb5b7fc154d7696f1e5ffd1e28dcad4a7b235e2c6491ed9d27c1d98f05fbf5a1acc35a2d20080aaa08880",
  "tags": [
    ["L", "open-location-code"],
    ["l", "8FXHH82F+36", "open-location-code"]
  ]
}
```

(The id and sig above belong to the historical kind 397 version of this event and do not verify for kind 30397; treat the example as illustrative.)

### 30398: Map note repost

The server republishes validated 30397 events as 30398. Same content and plus code requirements as 30397. Example:

```json
{
  "content": "hitchmap.com : I think this mark is meant to be one round about firther down the road, because thats where all the traffic from Schumen towards Ruse leaves. Here its mostly local cars.",
  "created_at": 1729246181,
  "id": "fbaa3fe49478b433210571e9665e65afae17660cda66328b286dcd31b8ddc9ab",
  "kind": 30398,
  "pubkey": "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b",
  "sig": "944a9aff569eaa7a314fc075000af2feaadc112fb410d988ee720505cc658ae087a8395970a053f6e2fd0754c8a5abd6d25df2f8b9f9f6d3ce2de55f6c5404be",
  "tags": [
    ["e", "3aead33745e6f53f41ed4763ce86b1ef3a77cf460beb2b11b729349a28bcbb27"],
    ["p", "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209"],
    [
      "d",
      "53055ee011e96a00a705b38253b9cbc6614ccbd37df4dad42ec69bbe608c4209:3aead33745e6f53f41ed4763ce86b1ef3a77cf460beb2b11b729349a28bcbb27"
    ],
    ["original_created_at", "1729161787"],
    ["L", "open-location-code"],
    ["l", "8GM87XXC+47", "open-location-code"]
  ]
}
```

- The `d` tag is `${originalAuthorPubkey}:${originalEventId}`

### 30399: Third-party notes

The relay accepts the kind and checks only the base shape, so the tags are a convention. Third-party derived content notes can take this format:

```jsonc
{
  "content": "An example note posted by a third party collaborator to be shown in the Trustroots app",
  "created_at": 1729246181,
  "id": "...",
  "kind": 30399,
  "pubkey": "...",
  "sig": "...",
  "tags": [
    // OPTIONAL - An `e` tag makes sense if this event references another nsotr event
    ["e", "..."],
    // OPTIONAL - Likewise for the `p` tag if this event relates to a different nostr pubkey
    ["p", "..."],
    // OPTIONAL - If the note has an upstream `created_at` field, then the `original_created_at` tag should be set
    ["original_created_at", "1729161787"],
    // The `d` tag can be constructed according to the author's specification, if you are unfamiliar with what a d tag does, see nip1: https://github.com/nostr-protocol/nips/blob/master/01.md
    ["d", "unique_identifier_for_this_event"],
    // This `open-location-code` label identifies the area where this marker should be shown on the map
    ["L", "open-location-code"],
    ["l", "8GM87XXC+47", "open-location-code"],
    // The `open-location-code-prefix` labels allow this event to be filtered, they serve as an index
    ["L", "open-location-code-prefix"],
    ["l", "8GM87X00+", "8GM80000+", "8G000000+", "open-location-code-prefix"],
    // OPTIONAL - The event can optionally include which trustroots circles this event relates to
    // Circle `l` values are lowercase slugs with ASCII hyphens removed (e.g. beerbrewers), matching trustrootsimporttool.
    ["L", "trustroots-circle"],
    ["l", "hitchhikers", "trustroots-circle"],
    // OPTIONAL - The text that will appear in the link when this event is displayed
    ["linkLabel", "posted by @jdoe"],
    // OPTIONAL - The URL path to construct the link, the hostname is known according to the pubkey that published this event
    ["linkPath", "/point/123"]
  ]
}
```
