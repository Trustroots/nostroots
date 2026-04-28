# Trustroots Import Tool

Exports active public Trustroots host offers from an imported MongoDB database as
signed Nostr JSONL for direct import into the private strfry behind
`nip42.trustroots.org`.

## Usage

```sh
cd nip42relay
go run ./trustrootsimporttool \
  -mongo-uri mongodb://localhost:27017/trustroots \
  -nostr-sk-hex "$NOSTR_SK_HEX" \
  -output trustroots-hosts.jsonl
```

Useful options can also be provided as environment variables:

- `MONGO_URI`, default `mongodb://localhost:27017/trustroots`
- `NOSTR_SK_HEX`, required
- `OUTPUT`, default `trustroots-hosts.jsonl`
- `STATE_FILE`, default `.trustrootsimporttool-state.json`
- `LIMIT`, optional
- `LOG_EVERY`, default `1000`

The tool exports only public host offers with `status: "yes"` and
`showOnlyInMyCircles: false`. Hosts limited to shared Trustroots circles are not
exported.

The JSONL file can be copied to the strfry host and imported with the
operator’s normal strfry import workflow.

## Smoke test

```sh
go test ./trustrootsimporttool
LIMIT=5 go run ./trustrootsimporttool -nostr-sk-hex "$NOSTR_SK_HEX"
head -n 5 trustroots-hosts.jsonl
```
