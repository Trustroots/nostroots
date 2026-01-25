# Nostroots Web App

A web application that replicates the functionality of the nostroots mobile app, providing a map-based interface for sharing notes on the Nostr network.

## Features

- **Interactive Map**: View notes from various sources displayed on a Leaflet-based map
- **Note Posting**: Add notes to any location by right-clicking on the map
- **Key Management**: Generate new keys or import existing ones (nsec or mnemonic), NIP-07 support
- **Persistent Settings**: Your keys and preferences are stored locally

## Getting Started

It's just one file with HTML, CSS and JS.

## Relation to Mobile App

This web app provides similar functionality to the `nr-app` mobile app:
- Uses the same (default) relays
- Uses the same event formats (via `@trustroots/nr-common`)
- Compatible key formats

## Development Notes

### Committing Changes

The repository has pre-commit hooks that run ESLint on the `nr-app` folder. Since `nr-web` is a standalone HTML file and doesn't use the same tooling, you should skip the pre-commit hook when committing changes that only affect `nr-web`:

```bash
git commit --no-verify -m "Your commit message"
```
