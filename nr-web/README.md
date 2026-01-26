# Nostroots Web App

A vibed web application that replicates the functionality of the nostroots mobile app, providing a map-based interface for sharing notes on the Nostr network.

**Live version:** [https://nos.trustroots.org/](https://nos.trustroots.org/)

It's not a replacement for the app, it's a way to quickly try different things without going through the lengthy process of building and releasing a new version of the app.

This web app provides similar functionality to the `nr-app` mobile app:
- Uses the same (default) relays
- Uses the same event formats (via `@trustroots/nr-common`)
- Compatible key formats


## Features

- **Interactive Map**: View nostroots notes displayed on a Leaflet-based map
- **Note Posting**: Add notes to any pluscode location by clicking on the map
- **Key Management**: Generate new keys or import existing ones (nsec or mnemonic), NIP-07 extension support
- **Persistent Settings**: Preferences are stored locally, keys as well (if not using NIP-07)


## Getting Started

It's just one file with HTML, CSS and JS.



## Development Notes

### Testing

Tests are designed to run in Docker by default for consistency and safety. See [tests/README.md](tests/README.md) for details.

**Quick test commands:**
```bash
make test          # Run all tests
make test-watch    # Watch mode
make test-e2e      # E2E tests only
```

### Committing Changes

The repository has pre-commit hooks that run ESLint on the `nr-app` folder. Since `nr-web` is a standalone HTML file and doesn't use the same tooling, you should skip the pre-commit hook when committing changes that only affect `nr-web`:

```bash
git commit --no-verify -m "Your commit message"
```
