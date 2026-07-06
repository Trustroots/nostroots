# wikistr

Static read-only MediaWiki surface for public wikis advertised on Nostr.

Wikistr discovers `kind:31388` service adverts from:

- `wss://relay.guaka.org`
- `wss://nip42.trustroots.org`

It accepts public `service:wiki` adverts and pairs them with advertised
`service:cors-proxy` endpoints. MediaWiki API, render, and same-wiki resource
requests use the selected Wrapster proxy with NIP-98 authorization.

## Hash routes

The wiki slug and page title are encoded in the URL hash:

- `#nomadwiki`
- `#nomadwiki/en/Lisbon`

The slug comes from the wiki advert `d` tag, for example
`["d", "wiki:nomadwiki"]`.

## Local dev

Any static server works. One simple option:

```bash
cd vibe/web/examples/wikistr
python3 -m http.server 8788
```

Then open `http://localhost:8788/`.

## Tests

This app uses Node's built-in test runner, so no package install is needed:

```bash
npm test
```

## Future Work

Private per-npub wiki advert delivery can be added later with NIP-44/NIP-17.
This public app intentionally ships no private wiki credentials or built-in
private wiki presets.
