## Tasks

- [ ] Add shared constants and schemas for aggregate plus-code stats.
- [ ] Add `client` tags to new kind `10395` events from supported producers.
- [ ] Teach the daemon to decrypt subscriptions, count unique pubkeys by plus
  code, and publish replaceable aggregate events.
- [ ] Subscribe to aggregate stats in Vibe Web and store the latest event by
  plus code.
- [ ] Render stats in the Host & Meet header with a graceful empty/stale state.
- [ ] Add daemon unit tests, pipeline acceptance tests, and focused Vibe Web
  display tests.
