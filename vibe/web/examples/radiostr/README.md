# Radiostr

Social internet radio for nr-web. Listen to curated stations, chat on Nostr, and tune into what others are playing.

## Hash routes

Station deep links use the station id in the URL hash:

- `#groovesalad`
- `#fip`
- `#paradise`

## Nostr room

Radiostr uses an isolated `#radiostr` room on:

- `wss://relay.guaka.org`
- `wss://relay.trustroots.org`
- `wss://nip42.trustroots.org`

Chat messages are kind `1` notes with `["t", "radiostr"]` and an optional `["channel", "<stationId>"]` tag.

Now-playing notes add `["t", "nowplaying"]` and `["radiostr_station", "<stationId>"]`.

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
