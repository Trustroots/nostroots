# nip42relay

`nip42relay` is a standalone NIP-42 auth gate for a Nostr relay. It accepts
public WebSocket clients, requires NIP-42 authentication before reads and
writes, checks that the authenticated pubkey is linked to a Trustroots username
via NIP-05, and then proxies allowed traffic to strfry.

## Run locally

```sh
docker compose up --build
```

The compose stack starts:

- `nip42relay` on `ws://localhost:8042`
- `strfry` as an internal upstream on `ws://strfry:5542`
- `strfry-data`, a clean unseeded named volume that persists across restarts
- `nip42relay-data`, a named volume for the SQLite auth cache

To reset the local strfry database:

```sh
docker compose down -v
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `LISTEN_ADDR` | `:8042` | HTTP/WebSocket listen address. |
| `PUBLIC_RELAY_URL` | `ws://localhost:8042` | Relay URL expected in NIP-42 auth events. |
| `UPSTREAM_RELAY_URL` | `ws://strfry:5542` | Private upstream relay URL. |
| `AUTH_CACHE_PATH` | `./auth-cache.db` | SQLite auth cache path. |
| `TRUSTROOTS_NIP05_BASE_URL` | `https://www.trustroots.org/.well-known/nostr.json` | NIP-05 endpoint. |
| `AUTH_CACHE_TTL` | `24h` | Successful authorization cache lifetime. |
| `AUTH_EVENT_MAX_AGE` | `10m` | Allowed timestamp skew for NIP-42 auth events. |

## Behavior

- The relay sends `["AUTH", "<challenge>"]` after a WebSocket connection opens.
- `REQ` and `EVENT` are rejected until the client sends a valid NIP-42 auth
  event.
- The auth event must be kind `22242`, signed by the pubkey, include the
  connection challenge, and include the configured public relay URL.
- The authenticated pubkey must have a profile event (kind `10390` or kind `0`)
  that declares a Trustroots username. The relay checks the configured upstream
  plus `wss://relay.trustroots.org` and `wss://relay.nomadwiki.org`. The
  username must resolve through Trustroots NIP-05 to the same pubkey.
- Authenticated users may only publish events signed by their authenticated
  pubkey.

The upstream strfry relay should not be exposed publicly in production. Public
clients should connect only to `nip42relay`.
