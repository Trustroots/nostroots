# Trustroots Import Tool

Exports active public Trustroots host offers from an imported MongoDB database as
signed Nostr JSONL for direct import into the private strfry behind
`nip42.trustroots.org`.

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
- `LIMIT`, optional
- `LOG_EVERY`, default `1000`
- `CHECK_RELAY_URLS`, comma-separated list, default `wss://nip42.trustroots.org`

The tool auto-loads `.env` from the current working directory and from
`trustrootsimporttool/.env` (when running from `nip42relay`).

The tool exports claimable Trustroots data only for eligible users and emits:

- imported host mirror events (`kind 30398`, existing behavior)
- profile claim suggestions (`kind 30390`)
- host claim suggestions (`kind 30391`)
- relationship claim suggestions (`kind 30392`)
- positive experience claim suggestions (`kind 30393`)

Eligibility rules:

- user must have valid `nostrNpub`
- user must be public, not suspended/shadow-banned, and have confirmed email
- relationships require both users to be eligible with valid npubs
- experiences must be positive/recommended and not hidden

Before emitting claim suggestions, the tool can connect to private relays with
its NSEC and skip data already user-signed by the account owner (kind `0`,
`30397`, `3`, `30000`, `1985` checks).

The JSONL file can be copied to the strfry host and imported with the
operator’s normal strfry import workflow.

## Smoke test

```sh
go test ./trustrootsimporttool
LIMIT=5 go run ./trustrootsimporttool -nsec "$NSEC"
head -n 5 trustroots-hosts.jsonl
```
