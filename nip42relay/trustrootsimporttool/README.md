# Trustroots Import Tool

Exports Trustroots data from an imported MongoDB database as signed Nostr JSONL
for direct import into the private strfry behind `nip42.trustroots.org`.

Outputs (in this order):

- **Profile claims** (`kind 30390`) — Nostr profile JSON for each eligible user (from Mongo; not a live kind-0 fetch)
- **Host mirrors** (`kind 30398`) — verified map note reposts for public host offers
- **Relationship suggestions** (`kind 30392`) — contacts between two eligible users (both have npubs)
- **Positive experience suggestions** (`kind 30393`) — experiences between two eligible users

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

**Hosts:** same rules as before (public host offer, valid npub, etc.).

**Contacts & experiences:** BSON fields match Trustroots Mongoose models (`userFrom` /
`userTo`, etc.). Experiences must be **`public: true`**
with **`recommend: "yes"`** (Trustroots enum). Both endpoints must be eligible users.

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
