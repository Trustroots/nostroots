# Radiostr

Social internet radio for nr-web. Listen to internet radio stations (catalog from [radio-guaka](https://radio.guaka.org/)), chat on Nostr, and tune into what others are playing.

## Hash routes

Station deep links use the station id in the URL hash:

- `#groovesalad`
- `#fip`
- `#paradise`

## Nostr room

Radiostr uses an isolated `#radiostr` room on:

- `wss://relay.trustroots.org`
- `wss://relay.nomadwiki.org`

Chat messages are kind `1` notes with `["t", "radiostr"]` and an optional `["channel", "<stationId>"]` tag.

Only users with a verified Trustroots NIP-05 (`username@trustroots.org`) can post chat. Chat shows Trustroots NIP-05 for authors; messages without a Trustroots identity are hidden.

Posting requires a NIP-07 browser extension (no ephemeral keys).

Now-playing notes add `["t", "nowplaying"]` and `["radiostr_station", "<stationId>"]`.

Starred stations are kind `1` notes with `["t", "radiostr"]`, `["t", "favorite"]`, `["radiostr_station", "<stationId>"]`, and `["radiostr_action", "star"]` or `"unstar"`. Latest action per station wins on sync. With NIP-07, stars publish to relays and merge on connect; without a signer, stars stay in `localStorage` only.

## Local dev

Serve `vibe/web/` from any static host, then open `/examples/radiostr/`.

```bash
cd vibe/web
python3 -m http.server 8788
```

## Tests

```bash
cd vibe/web/examples/radiostr
npm test
```
