## Tasks

- [ ] Thread relay URL/source metadata from subscription callbacks into map-note
  and chat event ingest.
- [ ] Store `seenFromRelayUrls` or equivalent source metadata without modifying
  the signed Nostr event payload.
- [ ] Derive relay-scope display from explicit source URLs.
- [ ] Decide whether to render a neutral unknown affordance or no icon for
  unresolved source state.
- [ ] Add focused unit/integration tests for public, auth, mixed, and unknown
  received-event display.
