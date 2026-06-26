# Vibe

`vibe/` contains the Nostroots web/browser stack that can move independently of
the main `nr-app`, `nr-common`, and `nr-notification-daemon` stack.

- `web/` - Nostroots web app.
- `browser/` - Nostroots Browser. The native iOS app lives in `browser/ios`;
  the preserved Expo prototype lives in `browser/expo`.
- `nip42relay/` - Vibe NIP-42 relay and Trustroots import tooling.
- `push-notification-daemon/` - Vibe-only APNs notification daemon for
  Nostroots Browser.
- `docs/` - Vibe documentation moved from the web/browser prototypes.
- `openspec/` - Vibe-scoped OpenSpec baseline specs and backlog changes.

Durable Vibe behavior is captured in [`openspec/project.md`](openspec/project.md)
and [`openspec/specs/`](openspec/specs/). Narrative docs remain in
[`docs/`](docs/), with a local index at [`docs/README.md`](docs/README.md).
