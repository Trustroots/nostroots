# Trustroots Import Tool

Exports Trustroots data from an imported MongoDB database as signed Nostr JSONL
for direct import into the private strfry behind `nip42.trustroots.org`.

Outputs (in this order):

- **Profile claims** (`kind 30390`) — Nostr profile JSON for each eligible user (from Mongo; not a live kind-0 fetch), plus the same `L` / `l` / `t` **trustroots-circle** tags as host mirrors for every public tribe membership (so clients can show circles without a hosted offer)
- **Host mirrors** (`kind 30398`) — verified map note reposts for public host offers (`status: yes|maybe`); circle `l` / `t` tags use **hyphen-free** slugs (Mongo tribe slugs are normalized when building host rows and events; see `trustrootsCircleSlugForNostr` in `events.go` / `fetchPublicCircleSlugs` in `mongo.go`)
- **Relationship suggestions** (`kind 30392`) — confirmed two-sided contacts where both endpoints pass a relaxed Trustroots gate (public, username, email/roles) and **at least one** has a valid npub; missing npubs appear as NIP-32 username labels (`L` / `l` under `org.trustroots:username`)
- **Positive experience suggestions** (`kind 30393`) — same relaxed pair rule; author and target are tagged in stable order (`userFrom` then `userTo`) with `p` hex and/or username labels
- **Positive-reference trust metric** (`kind 30394`) — per eligible npub user, one metric event reporting how many positive Trustroots references they have received from other users
- **Circle metadata** (`kind 30410`) — one parameterized replaceable per public Mongo `tribes` row: JSON `name` / `about` / optional `picture` (Trustroots `uploads-circle` URL when the tribe has `image: true`). See [`docs/Events.md`](../../docs/Events.md) in this repo.

**nr-web chat:** Subscribes to kind `30410` from the **same hex pubkey** as this tool’s `-nsec` (see `TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX` in `nr-web/common.js`). After changing the signing key, update that constant (or derive hex with `nak` / nostr-tools from your `nsec`) so clients accept your relay’s circle directory.

There are **no relay-side dedupe checks**; stricter validation can live in clients (e.g. `nr-web`).

## Usage

```sh
cd nip42relay
go run ./trustrootsimporttool \
  -mongo-uri mongodb://localhost:27017/trustroots \
  -nsec "$NSEC" \
  -output trustroots-hosts.jsonl
```

Useful options can also be provided as environment variables:

- `MONGO_URI`, default `mongodb://localhost:27017/trustroots`
- `NSEC`, required (`nsec1...`)
- `OUTPUT`, default `trustroots-hosts.jsonl`
- `STATE_FILE`, default `.trustrootsimporttool-state.json`
- `LIMIT`, optional — **host offers only** (see Eligibility below)
- `LOG_EVERY`, default `1000`

The tool auto-loads `.env` from the current working directory and from
`trustrootsimporttool/.env` (when running from `nip42relay`).

### Eligibility

**Hosts:** public `type: host` + `status: yes|maybe`, valid npub (for the `p` claim tag), sane
coordinates, eligible user — and **`maxGuests` > 0** (Trustroots uses `0` for no capacity).
Offers with **`validUntil` in the past** are skipped. Rows that fail validation are logged and
skipped instead of aborting the run.

**Contacts & experiences:** BSON fields match Trustroots Mongoose models (`userFrom` /
`userTo`, etc.). Contacts must be confirmed two-sided relationships (`confirmed: true`). Experiences must be **`public: true`**
with **`recommend: "yes"`** (Trustroots enum). Both endpoints must pass the **relaxed** user gate (public profile, username, confirmed email, no blocked roles). **At least one** endpoint must have a **valid npub** so the JSONL row includes a real `p` tag (clients typically filter suggestions with `#p`). Rows with **no** valid npub on either side are skipped.

Each exported `30392` / `30393` has **one or two** hex `p` tags (never a fake pubkey) plus optional **`L` / `l`** username labels for users without an npub. Downstream importers should tolerate this shape.

The `-limit` / `LIMIT` flag applies **only** to the host-offers query, not contacts or
experiences (so a small host limit no longer starves relationship/experience export).

The JSONL file can be copied to the strfry host and imported with the operator’s
normal strfry import workflow.

## Export invariants for image + route consumption

Use these checks to verify that import output matches `nr-web` rendering expectations.

- `30390` profile claim:
  - content `picture` follows Trustroots profile image rules:
    - explicit `avatar` URL when present
    - local upload fallback: `https://www.trustroots.org/uploads-profile/<userId>/avatar/256.jpg[?<updatedMs>]`
    - gravatar fallback: `https://www.gravatar.com/avatar/<emailHash>?s=256&d=identicon`
  - tags include:
    - `d=trustroots:profile:<username-lower>`
    - `l=<username-lower>` under `org.trustroots:username`
    - `source=trustroots-import`
    - `claimable=true`
- `30398` host mirror:
  - includes a real hex `p` tag from user `npub`
  - note content includes cleaned host text only (no appended Trustroots profile URL, no raw `npub`, no `#hosting`)
  - includes `status=maybe` tag when Trustroots offer status is `maybe`
  - includes plus-code labels (`L/l`) and prefix labels for map routing
  - includes `claimable=true`
  - includes circle tags for every public membership slug:
    - `l=<slug-lower-no-hyphens>` under `trustroots-circle`
    - `t=<slug-lower-no-hyphens>`
- `30394` reference trust metric:
  - includes `p=<user-hex-pubkey>` target
  - includes metric labels `L=org.trustroots:metric` and `l=positive-references-received`
  - content JSON includes numeric `value` (positive references received)
  - includes `claimable=true`

## Schema verification note

Schema verified against Trustroots upstream: metric source is `referencethreads` with `reference: "yes"`, counted per `userTo` (excluding self-references).
- `30410` circle metadata:
  - `d=<slug-lower-no-hyphens>` (lowercased + trimmed; ASCII hyphens removed for Nostr tags)
  - content has `name`, `about`, and optional `picture`
  - `picture` is emitted only when tribe image exists:
    - `https://www.trustroots.org/uploads-circle/<mongo-slug-lower>/742x496.jpg` (Mongo slug segment, hyphens preserved when present)
  - includes `source=trustroots-import`

## Smoke test

```sh
go test ./trustrootsimporttool
LIMIT=5 go run ./trustrootsimporttool -nsec "$NSEC"
head -n 5 trustroots-hosts.jsonl
```

## Manual verification with nr-web routes

After import, verify route-level behavior in `nr-web`:

1. Generate sample JSONL:
   ```sh
   cd nip42relay
   LIMIT=20 go run ./trustrootsimporttool -nsec "$NSEC" -output trustroots-hosts.jsonl
   ```
2. Inspect JSONL lines quickly:
   - `30390` should include `uploads-profile/.../avatar/256.jpg` where expected
   - `30410` should include circle `picture` for circles with images
   - `30398` should include `trustroots-circle` + `t` tags for the same slugs
3. Import JSONL into your local strfry / nip42 setup.
4. Open `nr-web/test.html` and run **Image tests** for known profile/circle URLs.
5. Open `nr-web/index.html` and verify:
   - `#profile/nostroots%40trustroots.org` shows expected profile avatar
   - `#hitchhikers` surfaces the circle image in chat/circle UI when metadata is present
- `30392` relationship suggestion:
  - includes `claimable=true`
  - includes `confirmed=true`
- `30393` positive experience suggestion:
  - includes `claimable=true`
