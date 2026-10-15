# Contributing to Nostroots

Thank you for helping. Please read [PHILOSOPHY.md](PHILOSOPHY.md) first. We want interoperability, and we are deliberate about where our events and offers show up.

## Proposing NIPs, new event kinds or integrations

Proposals should consider fit with these ideals and the practical limits of the protocol:

- **Fit with our ideals.** How does the proposal affect who sees members' content and offers? See [PHILOSOPHY.md](PHILOSOPHY.md).
- **Practical limits of the protocol.** Research the known limitations of the NIP or design you propose. Some NIPs turn out to be unfeasible for Nostroots because of them, so it helps to show that this has been looked at.

The rationale sections in [docs/Events.md](docs/Events.md) show the kind of reasoning we mean:

- [Why map notes use kind `30397` and not kind `1`](docs/Events.md#30397-map-note)
- [Why validation does not use NIP-32 labels](docs/Events.md#canonical-events-and-validation)
- [Why Plus Codes and not geohash](docs/Events.md#why-plus-codes-not-geohash)

Other kinds can be supported when needed, but this requires checking interoperability first, for example geohash versus Plus Codes for location.

## Code and docs

See [AGENTS.md](AGENTS.md) for architecture, commands, commit conventions and testing, and the README of each package for working on it.
