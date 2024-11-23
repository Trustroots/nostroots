## Events

An example post that should appear on the map (note this kind will change to 30397).

```json
{
  "content": "Hitchhikers: you might be able to get out of Nuremberg on the A9 towards Berlin here. Never used it myself, but there might be some climbing involved.",
  "created_at": 1727447770,
  "id": "d7973070d50b58e53705b98953b7b81d33058f6a516cc292805d9d8920d97588",
  "kind": 397,
  "pubkey": "fe5e4c6132c64427f40c525b9a436f91637cfff3f656ce06c526262406c5a606",
  "sig": "254f18848e32e8a7c0cd30ce858e4ca334093c22feefb5b7fc154d7696f1e5ffd1e28dcad4a7b235e2c6491ed9d27c1d98f05fbf5a1acc35a2d20080aaa08880",
  "tags": [
    ["L", "open-location-code"],
    ["l", "8FXHH82F+36", "open-location-code"]
  ]
}
```

An example of a moderation event:

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
  - This will change when the `397` becomes a `30397` because it will needs its own `d` tag and that will need to be incorporated in the `d` tag of the derived `30398` event

Third party derived content notes can take this format:

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
    ["L", "trustroots-circle"],
    ["l", "hitchhikers", "trustroots-circle"],
    // OPTIONAL - The text that will appear in the link when this event is displayed
    ["linkLabel", "posted by @jdoe"],
    // OPTIONAL - The URL path to construct the link, the hostname is known according to the pubkey that published this event
    ["linkPath", "/point/123"]
  ]
}
```
