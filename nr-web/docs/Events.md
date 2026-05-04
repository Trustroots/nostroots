## Events


specific nr-web Events documentation:

## Map-note trust model (`30397` / `30398`)

For Trustroots map-note validation context in `nr-web` (including the `30397 -> nr-server -> 30398` path and the NIP-42 auth-relay `30397` path), see [`TRUSTROOTS_MAP_NOTES.md`](TRUSTROOTS_MAP_NOTES.md).

## Kind 30410 — Trustroots circle metadata (directory)

Signed by the **same** key as the Trustroots Mongo JSONL export (`trustrootsimporttool` `-nsec`). Clients trust only this author’s pubkey (hardcoded in nr-web next to relay docs).

**Purpose:** Give circle-scoped UIs (for example nr-web chat channels tagged with `trustroots-circle`) a display **name**, **about** text, and **picture** URL aligned with Trustroots tribes.

**Kind:** `30410` (parameterized replaceable, NIP-01).

**Tags (recommended order):**

- `["d", "<slug>"]` — lowercase circle slug (stable identifier; must match `l` value below).
- `["L", "trustroots-circle"]`
- `["l", "<slug>", "trustroots-circle"]`
- `["source", "trustroots-import"]` — optional, for debugging.

**Content:** UTF-8 JSON object, same field names as Nostr kind `0` metadata where applicable:

```json
{
  "name": "Hitchhikers",
  "about": "Short description from Trustroots tribe.",
  "picture": "https://www.trustroots.org/uploads-circle/hitch/742x496.jpg"
}
```

- `name` — tribe `label`.
- `about` — tribe `description` (may be empty).
- `picture` — absolute URL to the circle image when the tribe has `image: true`, using Trustroots’ `uploads-circle/<slug>/<dimensions>.jpg` layout (see Trustroots `modules/tribes/client/utils/index.js`). Omitted or empty when there is no image.

**Replaceability:** Latest event per (`pubkey`, `kind`, `d`) wins on relays that apply replaceable rules.
