# Trustroots Import Tool

Exports Trustroots data from an imported MongoDB database as signed Nostr JSONL
for direct import into the private strfry behind `nip42.trustroots.org`.

Outputs (in this order):

- **Profile claims** (`kind 30390`) — Nostr profile JSON for each eligible user (from Mongo; not a live kind-0 fetch)
- **Host mirrors** (`kind 30398`) — verified map note reposts for public host offers
- **Relationship suggestions** (`kind 30392`) — contacts where both endpoints pass a relaxed Trustroots gate (public, username, email/roles) and **at least one** has a valid npub; missing npubs appear as NIP-32 username labels (`L` / `l` under `org.trustroots:username`)
- **Positive experience suggestions** (`kind 30393`) — same relaxed pair rule; author and target are tagged in stable order (`userFrom` then `userTo`) with `p` hex and/or username labels
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

**Hosts:** public `type: host` + `status: yes`, valid npub (for the `p` claim tag), sane
coordinates, eligible user — and **`maxGuests` > 0** (Trustroots uses `0` for no capacity).
Offers with **`validUntil` in the past** are skipped. Rows that fail validation are logged and
skipped instead of aborting the run.

**Contacts & experiences:** BSON fields match Trustroots Mongoose models (`userFrom` /
`userTo`, etc.). Experiences must be **`public: true`**
with **`recommend: "yes"`** (Trustroots enum). Both endpoints must pass the **relaxed** user gate (public profile, username, confirmed email, no blocked roles). **At least one** endpoint must have a **valid npub** so the JSONL row includes a real `p` tag (clients typically filter suggestions with `#p`). Rows with **no** valid npub on either side are skipped.

Each exported `30392` / `30393` has **one or two** hex `p` tags (never a fake pubkey) plus optional **`L` / `l`** username labels for users without an npub. Downstream importers should tolerate this shape.

The `-limit` / `LIMIT` flag applies **only** to the host-offers query, not contacts or
experiences (so a small host limit no longer starves relationship/experience export).

The JSONL file can be copied to the strfry host and imported with the operator’s
normal strfry import workflow.

## Smoke test

```sh
go test ./trustrootsimporttool
LIMIT=5 go run ./trustrootsimporttool -nsec "$NSEC"
head -n 5 trustroots-hosts.jsonl
```
